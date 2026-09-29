//! Embedded librqbit engine for TorrentX.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use librqbit::api::TorrentIdOrHash;
use librqbit::dht::Id20;
use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, ListenerOptions, ManagedTorrent, Session,
    SessionOptions, SessionPersistenceConfig, TorrentStatsState,
};
use torrentx_core::{
    AddSource, EngineError, EngineResult, FileInfo, Status, Torrent, TorrentDetails, check_uri,
    parse_id,
};

pub struct RqbitEngine {
    session: Arc<Session>,
    state_dir: PathBuf,
    /// librqbit has no "added at"; remember first sighting, seeded from the
    /// persisted .torrent file's mtime so it survives restarts.
    // ponytail: mtime-based, add a persisted map if exact add times ever matter
    added_at: Mutex<HashMap<Id20, i64>>,
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_default()
}

fn unavailable(e: impl std::fmt::Display) -> EngineError {
    EngineError::Unavailable(format!("{e:#}"))
}

impl RqbitEngine {
    /// `state_dir` holds librqbit's session persistence (torrent list + resume data).
    pub async fn start(download_dir: &Path, state_dir: &Path) -> EngineResult<Self> {
        std::fs::create_dir_all(download_dir).map_err(|e| {
            EngineError::Unavailable(format!(
                "cannot create download directory {}: {e}",
                download_dir.display()
            ))
        })?;
        let opts = SessionOptions {
            fastresume: true,
            persistence: Some(SessionPersistenceConfig::Json {
                folder: Some(state_dir.to_path_buf()),
            }),
            listen: Some(ListenerOptions {
                enable_upnp_port_forwarding: true,
                ..Default::default()
            }),
            ..Default::default()
        };
        let session = Session::new_with_opts(download_dir.to_path_buf(), opts)
            .await
            .map_err(unavailable)?;
        Ok(Self {
            session,
            state_dir: state_dir.to_path_buf(),
            added_at: Mutex::new(HashMap::new()),
        })
    }

    fn handle(&self, id: &str) -> EngineResult<Arc<ManagedTorrent>> {
        let id = parse_id(id)?;
        let hash: Id20 = id
            .parse()
            .map_err(|_| EngineError::NotFound(format!("torrent {id} not found")))?;
        self.session
            .get(TorrentIdOrHash::Hash(hash))
            .ok_or_else(|| EngineError::NotFound(format!("torrent {id} not found")))
    }

    fn added_at(&self, hash: Id20) -> i64 {
        let mut map = self.added_at.lock().unwrap();
        *map.entry(hash).or_insert_with(|| {
            std::fs::metadata(self.state_dir.join(format!("{hash:?}.torrent")))
                .and_then(|m| m.modified())
                .ok()
                .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                .map(|d| d.as_secs() as i64)
                .unwrap_or_else(unix_now)
        })
    }

    fn to_torrent(&self, t: &ManagedTorrent) -> Torrent {
        let stats = t.stats();
        let hash = t.info_hash();
        let live = stats.live.as_ref();
        let mbps_to_bytes = |mbps: f64| (mbps * 1024.0 * 1024.0) as u64;
        let download_rate = live
            .map(|l| mbps_to_bytes(l.download_speed.mbps))
            .unwrap_or(0);
        let status = match stats.state {
            TorrentStatsState::Initializing { .. } => Status::Checking,
            TorrentStatsState::Paused => Status::Paused,
            TorrentStatsState::Error => Status::Error,
            TorrentStatsState::Live if stats.finished => Status::Seeding,
            TorrentStatsState::Live => Status::Downloading,
        };
        Torrent {
            id: format!("{hash:?}"),
            name: t.name().unwrap_or_else(|| format!("{hash:?}")),
            size: stats.total_bytes,
            progress: if stats.total_bytes == 0 {
                0.0
            } else {
                stats.progress_bytes as f64 / stats.total_bytes as f64
            },
            download_rate,
            upload_rate: live
                .map(|l| mbps_to_bytes(l.upload_speed.mbps))
                .unwrap_or(0),
            peers: live.map(|l| l.snapshot.peer_stats.live).unwrap_or(0),
            // librqbit does not tell seeds from leechers.
            seeds: 0,
            status,
            error: stats.error.clone(),
            eta_secs: (status == Status::Downloading && download_rate > 0)
                .then(|| stats.total_bytes.saturating_sub(stats.progress_bytes) / download_rate),
            added_at: self.added_at(hash),
            save_path: t.output_folder().to_string_lossy().into_owned(),
        }
    }

    pub async fn list(&self) -> EngineResult<Vec<Torrent>> {
        Ok(self
            .session
            .with_torrents(|all| all.map(|(_, t)| self.to_torrent(t)).collect()))
    }

    pub async fn get(&self, id: &str) -> EngineResult<TorrentDetails> {
        let handle = self.handle(id)?;
        let torrent = self.to_torrent(&handle);
        let progress = handle.stats().file_progress;
        let files = handle
            .with_metadata(|m| {
                m.file_infos
                    .iter()
                    .enumerate()
                    .map(|(i, f)| {
                        let done = progress.get(i).copied().unwrap_or(0);
                        FileInfo {
                            path: f.relative_filename.to_string_lossy().into_owned(),
                            size: f.len,
                            progress: if f.len == 0 {
                                1.0
                            } else {
                                done as f64 / f.len as f64
                            },
                        }
                    })
                    .collect()
            })
            // Magnet whose metadata isn't resolved yet: no files known.
            .unwrap_or_default();
        Ok(TorrentDetails { torrent, files })
    }

    pub async fn add(&self, source: AddSource) -> EngineResult<String> {
        let add = match source {
            AddSource::Uri(uri) => AddTorrent::from_url(check_uri(&uri)?.to_string()),
            AddSource::Bytes(bytes) => AddTorrent::from_bytes(bytes),
        };
        let resp = self
            .session
            .add_torrent(add, Some(AddTorrentOptions::default()))
            .await
            .map_err(|e| EngineError::InvalidInput(format!("{e:#}")))?;
        match resp {
            AddTorrentResponse::Added(_, h) => {
                let hash = h.info_hash();
                self.added_at.lock().unwrap().insert(hash, unix_now());
                Ok(format!("{hash:?}"))
            }
            AddTorrentResponse::AlreadyManaged(_, h) => Err(EngineError::Duplicate(format!(
                "torrent {:?} already added",
                h.info_hash()
            ))),
            AddTorrentResponse::ListOnly(_) => Err(EngineError::Unavailable(
                "unexpected list-only response".into(),
            )),
        }
    }

    pub async fn pause(&self, id: &str) -> EngineResult<()> {
        let handle = self.handle(id)?;
        if handle.is_paused() {
            return Ok(());
        }
        self.session.pause(&handle).await.map_err(unavailable)
    }

    pub async fn resume(&self, id: &str) -> EngineResult<()> {
        let handle = self.handle(id)?;
        if !handle.is_paused() {
            return Ok(());
        }
        self.session.unpause(&handle).await.map_err(unavailable)
    }

    pub async fn remove(&self, id: &str, delete_data: bool) -> EngineResult<()> {
        let handle = self.handle(id)?;
        self.session
            .delete(TorrentIdOrHash::Hash(handle.info_hash()), delete_data)
            .await
            .map_err(unavailable)
    }

    pub async fn shutdown(&self) {
        self.session.stop().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Public-domain test torrent (Sintel, WebTorrent test set).
    const MAGNET: &str = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.webtorrent.dev";

    #[tokio::test]
    async fn rejects_garbage_and_unknown_ids() {
        let tmp = std::env::temp_dir().join(format!("torrentx-rqbit-{}", std::process::id()));
        let e = RqbitEngine::start(&tmp.join("dl"), &tmp.join("state"))
            .await
            .unwrap();
        let err = e
            .add(AddSource::Uri("not-a-magnet".into()))
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

    /// Needs network. Torrents and their paused state survive a restart.
    #[tokio::test]
    #[ignore]
    async fn persistence_across_restart() {
        const BUNNY: &str = "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337&tr=wss%3A%2F%2Ftracker.webtorrent.dev";
        let tmp =
            std::env::temp_dir().join(format!("torrentx-rqbit-persist-{}", std::process::id()));
        let (dl, state) = (tmp.join("dl"), tmp.join("state"));

        let e = RqbitEngine::start(&dl, &state).await.unwrap();
        let a = e.add(AddSource::Uri(MAGNET.into())).await.unwrap();
        let b = e.add(AddSource::Uri(BUNNY.into())).await.unwrap();
        e.pause(&b).await.unwrap();
        e.shutdown().await;
        drop(e);

        let e = RqbitEngine::start(&dl, &state).await.unwrap();
        // Restored torrents initialize asynchronously; give them a moment.
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
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
        let tmp = std::env::temp_dir().join(format!("torrentx-rqbit-net-{}", std::process::id()));
        let e = RqbitEngine::start(&tmp.join("dl"), &tmp.join("state"))
            .await
            .unwrap();
        let id = e.add(AddSource::Uri(MAGNET.into())).await.unwrap();
        assert_eq!(id, "08ada5a7a6183aae1e09d831df6748d566095a10");
        assert_eq!(
            e.add(AddSource::Uri(MAGNET.into()))
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
}
