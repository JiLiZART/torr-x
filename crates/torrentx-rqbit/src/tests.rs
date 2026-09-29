use std::time::Duration;

use super::*;
use librqbit::spawn_utils::BlockingSpawner;
use librqbit::{CreateTorrentOptions, create_torrent};

// Public-domain test torrents (WebTorrent test set).
const MAGNET: &str = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.webtorrent.dev";
const BUNNY: &str = "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.webtorrent.dev";

fn tmp(name: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("torrentx-rqbit-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&p);
    p
}

/// No DHT / UPnP so offline tests stay offline.
fn offline() -> EngineTuning {
    let mut t = EngineTuning::default();
    t.network.upnp = false;
    t.advanced.dht = false;
    t
}

/// Multi-file torrent "fx" (a.bin 40000 B, b.txt 5 B) whose data lives in `dir/fx`.
async fn fixture(dir: &Path) -> Vec<u8> {
    let root = dir.join("fx");
    std::fs::create_dir_all(&root).unwrap();
    let a: Vec<u8> = (0..40_000u32).map(|i| (i * 7 % 251) as u8).collect();
    std::fs::write(root.join("a.bin"), a).unwrap();
    std::fs::write(root.join("b.txt"), b"hello").unwrap();
    let opts = CreateTorrentOptions {
        name: None,
        trackers: vec!["udp://tracker.example:80".into()],
        piece_length: Some(16384),
    };
    let mut t = create_torrent(&root, opts, &BlockingSpawner::new(1))
        .await
        .unwrap();
    t.meta.comment = Some(b"test comment"[..].into());
    t.meta.created_by = Some(b"torrentx-test"[..].into());
    t.meta.creation_date = Some(1_700_000_000);
    t.as_bytes().unwrap().to_vec()
}

/// Polls until the torrent is past its initial check and `ok` holds.
async fn wait(e: &RqbitEngine, id: &str, ok: impl Fn(&TorrentDetails) -> bool) -> TorrentDetails {
    for _ in 0..100 {
        let d = e.get(id).await.unwrap();
        if d.torrent.status != Status::Checking && ok(&d) {
            return d;
        }
        tokio::time::sleep(Duration::from_millis(200)).await;
    }
    panic!("timed out: {:?}", e.get(id).await.unwrap().torrent);
}

#[tokio::test]
async fn rejects_garbage_and_unknown_ids() {
    let tmp = tmp("garbage");
    let e = RqbitEngine::start(&tmp.join("dl"), &tmp.join("state"), &offline())
        .await
        .unwrap();
    let err = e
        .add(
            AddSource::Uri("not-a-magnet".into()),
            &AddOptions::default(),
        )
        .await
        .unwrap_err();
    assert_eq!(err.kind(), "invalid_input");
    assert_eq!(
        e.pause(&"0".repeat(40)).await.unwrap_err().kind(),
        "not_found"
    );
    e.shutdown().await;
    let _ = std::fs::remove_dir_all(tmp);
}

#[tokio::test(flavor = "multi_thread")]
async fn fixture_fields_ops_relocate_verify() {
    let tmp = tmp("fixture");
    let src = tmp.join("src");
    let bytes = fixture(&src).await;
    let e = RqbitEngine::start(&tmp.join("dl"), &tmp.join("state"), &offline())
        .await
        .unwrap();

    let caps = e.capabilities().await;
    assert!(caps.supports("fileSkip") && !caps.supports("filePriority"));
    assert_eq!(caps.via("relocate"), Some(torrentx_core::Via::Server));

    // Preview: metadata only, nothing added.
    let p = e.preview(AddSource::Bytes(bytes.clone())).await.unwrap();
    assert_eq!(p.name, "fx");
    assert_eq!((p.size, p.piece_size, p.pieces), (40_005, 16384, 3));
    assert_eq!(p.created_by.as_deref(), Some("torrentx-test"));
    assert_eq!(p.comment.as_deref(), Some("test comment"));
    assert_eq!(p.created_at, Some(1_700_000_000));
    assert_eq!(p.trackers, ["udp://tracker.example:80"]);
    let mut paths: Vec<_> = p.files.iter().map(|f| (f.path.as_str(), f.size)).collect();
    paths.sort();
    assert_eq!(paths, [("a.bin", 40_000), ("b.txt", 5)]);
    assert!(e.list().await.unwrap().is_empty());

    // Add into `src` with a name subfolder: finds the existing data.
    let opts = AddOptions {
        save_path: Some(src.to_string_lossy().into_owned()),
        create_subfolder: Some(true),
        paused: Some(false),
        ..Default::default()
    };
    let id = e.add(AddSource::Bytes(bytes.clone()), &opts).await.unwrap();
    assert_eq!(id, p.id);
    let d = wait(&e, &id, |d| d.torrent.progress == 1.0).await;
    assert_eq!(d.torrent.save_path, src.to_string_lossy());
    assert_eq!((d.torrent.size, d.torrent.wanted_size), (40_005, 40_005));
    assert_eq!((d.piece_size, d.pieces), (Some(16384), Some(3)));
    assert_eq!(d.created_by.as_deref(), Some("torrentx-test"));
    assert_eq!(d.trackers[0].url, "udp://tracker.example:80");
    assert!(d.files.iter().all(|f| f.wanted && f.progress == 1.0));
    assert_eq!(e.torrent_file(&id).await.unwrap(), bytes);
    let pieces = e.pieces(&id).await.unwrap();
    assert_eq!(pieces.count, 3);
    assert_eq!(pieces.bitfield[0] & 0b1110_0000, 0b1110_0000);

    // File skip; priority is unsupported.
    let b = d.files.iter().find(|f| f.path == "b.txt").unwrap().index;
    e.set_files(&id, &[b], Some(false), None).await.unwrap();
    let d = e.get(&id).await.unwrap();
    assert!(!d.files[b as usize].wanted);
    assert_eq!(d.torrent.wanted_size, 40_000);
    let err = e.set_files(&id, &[b], None, Some(Priority::High)).await;
    assert_eq!(err.unwrap_err().kind(), "unsupported");
    e.set_files(&id, &[b], Some(true), None).await.unwrap();
    assert_eq!(e.rename(&id, "x").await.unwrap_err().kind(), "unsupported");

    // Relocate keeps the hash, progress and the name subfolder.
    let dst = tmp.join("dst");
    e.relocate(&id, &dst.to_string_lossy()).await.unwrap();
    let d = wait(&e, &id, |d| d.torrent.progress == 1.0).await;
    assert_eq!(d.torrent.save_path, dst.to_string_lossy());
    assert!(dst.join("fx/a.bin").exists() && !src.join("fx/a.bin").exists());

    // Verify re-hashes: a corrupted piece is detected.
    let a = dst.join("fx/a.bin");
    let mut data = std::fs::read(&a).unwrap();
    data[0] ^= 0xff;
    std::fs::write(&a, data).unwrap();
    e.pause(&id).await.unwrap();
    e.verify(&id).await.unwrap();
    let d = wait(&e, &id, |_| true).await;
    assert!(d.torrent.progress < 1.0, "{}", d.torrent.progress);
    assert_eq!(d.torrent.status, Status::Paused);

    // Rate limits are live, network options need a restart.
    let mut t = offline();
    t.network.max_download_kbps = 100;
    assert!(!e.apply_settings(&t).await.unwrap());
    t.advanced.dht = true;
    assert!(e.apply_settings(&t).await.unwrap());

    e.remove(&id, false).await.unwrap();
    e.shutdown().await;
    let _ = std::fs::remove_dir_all(tmp);
}

#[test]
fn move_files_moves_and_cleans_up() {
    let tmp = tmp("move");
    let (from, to) = (tmp.join("a"), tmp.join("b"));
    std::fs::create_dir_all(from.join("sub")).unwrap();
    std::fs::write(from.join("sub/x"), b"x").unwrap();
    let files = [PathBuf::from("sub/x"), PathBuf::from("missing")];
    move_files(&from, &to, &files).unwrap();
    assert!(to.join("sub/x").exists());
    assert!(!from.join("sub").exists());
    let _ = std::fs::remove_dir_all(tmp);
}

/// Needs network. Torrents and their paused state survive a restart.
#[tokio::test]
#[ignore]
async fn persistence_across_restart() {
    let tmp = tmp("persist");
    let (dl, state) = (tmp.join("dl"), tmp.join("state"));
    let t = EngineTuning::default();
    let none = AddOptions::default();

    let e = RqbitEngine::start(&dl, &state, &t).await.unwrap();
    let a = e.add(AddSource::Uri(MAGNET.into()), &none).await.unwrap();
    let b = e.add(AddSource::Uri(BUNNY.into()), &none).await.unwrap();
    e.pause(&b).await.unwrap();
    e.shutdown().await;
    drop(e);

    let e = RqbitEngine::start(&dl, &state, &t).await.unwrap();
    // Restored torrents initialize asynchronously; give them a moment.
    tokio::time::sleep(Duration::from_secs(3)).await;
    let list = e.list().await.unwrap();
    assert_eq!(list.len(), 2);
    let status = |id: &str| list.iter().find(|t| t.id == id).unwrap().status;
    assert_eq!(status(&b), Status::Paused);
    assert_ne!(status(&a), Status::Paused);
    e.remove(&a, true).await.unwrap();
    e.remove(&b, true).await.unwrap();
    e.shutdown().await;
    let _ = std::fs::remove_dir_all(tmp);
}

/// Needs network. `cargo test -p torrentx-rqbit -- --ignored`
#[tokio::test]
#[ignore]
async fn magnet_lifecycle() {
    let tmp = tmp("net");
    let e = RqbitEngine::start(
        &tmp.join("dl"),
        &tmp.join("state"),
        &EngineTuning::default(),
    )
    .await
    .unwrap();
    let none = AddOptions::default();
    let id = e.add(AddSource::Uri(MAGNET.into()), &none).await.unwrap();
    assert_eq!(id, "08ada5a7a6183aae1e09d831df6748d566095a10");
    assert_eq!(
        e.add(AddSource::Uri(MAGNET.into()), &none)
            .await
            .unwrap_err()
            .kind(),
        "duplicate"
    );
    assert_eq!(e.list().await.unwrap().len(), 1);
    e.pause(&id).await.unwrap();
    assert_eq!(e.get(&id).await.unwrap().torrent.status, Status::Paused);
    e.resume(&id).await.unwrap();
    assert_ne!(e.get(&id).await.unwrap().torrent.status, Status::Paused);
    e.remove(&id, true).await.unwrap();
    assert!(e.list().await.unwrap().is_empty());
    e.shutdown().await;
    let _ = std::fs::remove_dir_all(tmp);
}

/// Needs network. Magnet preview, then add with a subset of files into a custom dir.
#[tokio::test(flavor = "multi_thread")]
#[ignore]
async fn magnet_add_subset_of_files() {
    let tmp = tmp("subset");
    let e = RqbitEngine::start(
        &tmp.join("dl"),
        &tmp.join("state"),
        &EngineTuning::default(),
    )
    .await
    .unwrap();
    let p = e.preview(AddSource::Uri(MAGNET.into())).await.unwrap();
    assert!(p.files.len() > 1, "{p:?}");
    assert!(e.list().await.unwrap().is_empty());
    let opts = AddOptions {
        save_path: Some(tmp.join("custom").to_string_lossy().into_owned()),
        create_subfolder: Some(true),
        paused: Some(true),
        wanted_files: Some(vec![0]),
        ..Default::default()
    };
    let id = e.add(AddSource::Uri(MAGNET.into()), &opts).await.unwrap();
    let d = e.get(&id).await.unwrap();
    assert_eq!(d.files.iter().filter(|f| f.wanted).count(), 1);
    assert!(d.files[0].wanted);
    assert_eq!(d.torrent.wanted_size, d.files[0].size);
    assert_eq!(d.torrent.save_path, tmp.join("custom").to_string_lossy());
    e.remove(&id, true).await.unwrap();
    e.shutdown().await;
    let _ = std::fs::remove_dir_all(tmp);
}

/// Needs network. A 64 KB/s download limit caps the observed rate.
#[tokio::test(flavor = "multi_thread")]
#[ignore]
async fn download_limit_caps_rate() {
    let tmp = tmp("limit");
    let e = RqbitEngine::start(
        &tmp.join("dl"),
        &tmp.join("state"),
        &EngineTuning::default(),
    )
    .await
    .unwrap();
    let mut t = EngineTuning::default();
    t.network.max_download_kbps = 64;
    assert!(!e.apply_settings(&t).await.unwrap());
    let id = e
        .add(AddSource::Uri(BUNNY.into()), &AddOptions::default())
        .await
        .unwrap();
    tokio::time::sleep(Duration::from_secs(20)).await;
    let (down, _) = e.session_totals().await.unwrap();
    let rate = e.get(&id).await.unwrap().torrent.download_rate;
    // 20 s at 64 KB/s (+ one burst of slack).
    assert!(down <= 64 * 1024 * 22, "downloaded {down}");
    assert!(rate <= 64 * 1024 * 2, "rate {rate}");
    e.remove(&id, true).await.unwrap();
    e.shutdown().await;
    let _ = std::fs::remove_dir_all(tmp);
}
