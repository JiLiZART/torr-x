//! Embedded librqbit engine for TorrentX.

use std::collections::{HashMap, HashSet};
use std::ffi::OsString;
use std::net::Ipv6Addr;
use std::num::NonZeroU32;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use librqbit::api::TorrentIdOrHash;
use librqbit::dht::Id20;
use librqbit::limits::LimitsConfig;
use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, Api, ConnectionOptions, DhtSessionConfig,
    ListOnlyResponse, ListenerOptions, ManagedTorrent, Session, SessionOptions,
    SessionPersistenceConfig, TorrentStatsState, torrent_from_bytes,
};
use torrentx_core::{
    AddOptions, AddSource, Capabilities, EngineError, EngineResult, EngineTuning, FileInfo, Peer,
    Pieces, Preview, PreviewFile, Priority, ProxyKind, Status, Torrent, TorrentDetails, Tracker,
    check_uri, parse_id,
};

const ENGINE: &str = "rqbit";

/// Settings that only take effect on a fresh session.
type RestartKey = (u16, bool, bool, Option<String>);

pub struct RqbitEngine {
    session: Arc<Session>,
    api: Api,
    download_dir: PathBuf,
    state_dir: PathBuf,
    restart_key: RestartKey,
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

fn invalid(e: impl std::fmt::Display) -> EngineError {
    EngineError::InvalidInput(format!("{e:#}"))
}

fn unsupported(what: &str) -> EngineError {
    EngineError::unsupported(ENGINE, what)
}

fn restart_key(t: &EngineTuning) -> RestartKey {
    let p = &t.network.proxy;
    // ponytail: credentials go into the URL verbatim; ones with URL-special chars break it
    let proxy = (p.kind == ProxyKind::Socks5 && !p.host.is_empty()).then(|| {
        let auth = if p.auth_required {
            format!("{}:{}@", p.username, p.password)
        } else {
            String::new()
        };
        format!("socks5://{auth}{}:{}", p.host, p.port)
    });
    (t.network.listen_port, t.network.upnp, t.advanced.dht, proxy)
}

/// KB/s → librqbit bytes/s. librqbit's limiter rejects a single 16 KiB block
/// above its burst (= the limit), so tiny limits are raised to 16 KiB/s.
fn bps(kbps: u32) -> Option<NonZeroU32> {
    const MIN: NonZeroU32 = NonZeroU32::new(16 * 1024).unwrap();
    NonZeroU32::new(kbps.saturating_mul(1024)).map(|b| b.max(MIN))
}

fn limits(t: &EngineTuning) -> LimitsConfig {
    LimitsConfig {
        upload_bps: bps(t.network.max_upload_kbps),
        download_bps: bps(t.network.max_download_kbps),
    }
}

/// createdBy, comment, createdAt, tracker URLs from raw .torrent bytes.
type MetaFields = (Option<String>, Option<String>, Option<i64>, Vec<String>);

fn meta_fields(torrent_bytes: &[u8]) -> MetaFields {
    let Ok(t) = torrent_from_bytes(torrent_bytes) else {
        return Default::default();
    };
    let s = |b: &librqbit::ByteBuf| String::from_utf8_lossy(b.as_ref()).into_owned();
    let mut trackers: Vec<String> = Vec::new();
    for url in t.iter_announce().map(s) {
        if !url.is_empty() && !trackers.contains(&url) {
            trackers.push(url);
        }
    }
    (
        t.created_by.as_ref().map(s),
        t.comment.as_ref().map(s),
        t.creation_date.map(|d| d as i64),
        trackers,
    )
}

/// Folder librqbit would create for a multi-file torrent (its default layout).
fn default_subfolder(name: Option<&str>, files: usize, hash: Id20) -> Option<PathBuf> {
    (files > 1).then(|| {
        name.map(PathBuf::from)
            .filter(|p| p.components().all(|c| matches!(c, Component::Normal(_))))
            .unwrap_or_else(|| PathBuf::from(format!("{hash:?}")))
    })
}

/// Splits librqbit's output folder into (save path, torrent-name subfolder), so
/// `save_path` means the same as Transmission's download dir.
// ponytail: a user-chosen save dir that happens to end in the torrent name is misread as a subfolder
fn split_output(t: &ManagedTorrent) -> (PathBuf, Option<OsString>) {
    let out = t.output_folder().to_path_buf();
    let multi = t.with_metadata(|m| m.file_infos.len() > 1).unwrap_or(false);
    match (multi, t.name(), out.file_name(), out.parent()) {
        (true, Some(name), Some(last), Some(parent)) if last == name.as_str() => {
            (parent.to_path_buf(), Some(last.to_owned()))
        }
        _ => (out, None),
    }
}

/// Moves `files` from `from` to `to`; on failure moves already-moved files back.
fn move_files(from: &Path, to: &Path, files: &[PathBuf]) -> std::io::Result<()> {
    fn mv(src: &Path, dst: &Path) -> std::io::Result<()> {
        if let Some(parent) = dst.parent() {
            std::fs::create_dir_all(parent)?;
        }
        // rename fails across filesystems; fall back to copy + delete.
        std::fs::rename(src, dst).or_else(|_| {
            std::fs::copy(src, dst)?;
            std::fs::remove_file(src)
        })
    }
    let mut moved: Vec<(PathBuf, PathBuf)> = Vec::new();
    for f in files {
        let (src, dst) = (from.join(f), to.join(f));
        if !src.exists() {
            continue;
        }
        if let Err(e) = mv(&src, &dst) {
            for (src, dst) in moved.iter().rev() {
                let _ = mv(dst, src);
            }
            return Err(e);
        }
        moved.push((src, dst));
    }
    // Drop now-empty directories left behind (best effort, deepest first).
    let mut dirs: Vec<PathBuf> = files
        .iter()
        .flat_map(|f| f.ancestors().skip(1).map(|a| from.join(a)))
        .collect();
    dirs.sort_by_key(|d| std::cmp::Reverse(d.components().count()));
    dirs.dedup();
    for d in dirs {
        let _ = std::fs::remove_dir(d);
    }
    Ok(())
}

impl RqbitEngine {
    /// `state_dir` holds librqbit's session persistence (torrent list + resume data).
    pub async fn start(
        download_dir: &Path,
        state_dir: &Path,
        tuning: &EngineTuning,
    ) -> EngineResult<Self> {
        std::fs::create_dir_all(download_dir).map_err(|e| {
            EngineError::Unavailable(format!(
                "cannot create download directory {}: {e}",
                download_dir.display()
            ))
        })?;
        let key = restart_key(tuning);
        let (port, upnp, dht, proxy) = key.clone();
        let opts = SessionOptions {
            fastresume: true,
            persistence: Some(SessionPersistenceConfig::Json {
                folder: Some(state_dir.to_path_buf()),
            }),
            // Port 0 = OS-assigned (librqbit's default).
            listen: Some(ListenerOptions {
                listen_addr: (Ipv6Addr::UNSPECIFIED, port).into(),
                enable_upnp_port_forwarding: upnp,
                ..Default::default()
            }),
            dht: dht.then(DhtSessionConfig::default),
            connect: proxy.map(|url| ConnectionOptions {
                proxy_url: Some(url),
                ..Default::default()
            }),
            ratelimits: limits(tuning),
            ..Default::default()
        };
        let session = Session::new_with_opts(download_dir.to_path_buf(), opts)
            .await
            .map_err(unavailable)?;
        Ok(Self {
            api: Api::new(session.clone(), None),
            session,
            download_dir: download_dir.to_path_buf(),
            state_dir: state_dir.to_path_buf(),
            restart_key: key,
            added_at: Mutex::new(HashMap::new()),
        })
    }

    pub async fn capabilities(&self) -> Capabilities {
        Capabilities::new(ENGINE)
            .engine(&[
                "fileSkip",
                "addPreview",
                "peerList",
                // librqbit reports the peer's extended-handshake client name.
                "peerClient",
                "pieces",
                "torrentFile",
                "speedLimits",
                "listenPort",
                "upnp",
                "proxySocks5",
                "dht",
            ])
            .server(&[
                "verify",
                "relocate",
                "rename",
                "queue",
                "seedLimits",
                "moveCompleted",
            ])
            .note("rename", "display name only")
            .note("seedLimits", "seeding time enforced by TorrentX")
            .note("trackerStatus", "tracker URLs only")
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
        // Per live session: librqbit resets these on pause/restart (server accumulates).
        let downloaded = live.map(|l| l.snapshot.fetched_bytes).unwrap_or(0);
        let uploaded = stats.uploaded_bytes;
        // stats.total_bytes covers the pieces of the selected files; report exact sizes.
        let only = t.only_files();
        let (size, wanted_size) = t
            .with_metadata(|m| {
                let wanted = m.file_infos.iter().enumerate();
                let wanted = wanted.filter(|(i, _)| only.as_ref().is_none_or(|o| o.contains(i)));
                (
                    m.info.lengths().total_length(),
                    wanted.map(|(_, f)| f.len).sum(),
                )
            })
            .unwrap_or((stats.total_bytes, stats.total_bytes));
        Torrent {
            id: format!("{hash:?}"),
            name: t.name().unwrap_or_else(|| format!("{hash:?}")),
            size,
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
            save_path: split_output(t).0.to_string_lossy().into_owned(),
            downloaded,
            uploaded,
            ratio: (downloaded > 0).then(|| uploaded as f64 / downloaded as f64),
            wanted_size,
            tab_id: None,
            priority: Priority::Normal,
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
        let only = handle.only_files();
        let mut details = TorrentDetails {
            torrent,
            piece_size: None,
            pieces: None,
            availability: None,
            wasted: None,
            created_by: None,
            comment: None,
            created_at: None,
            trackers: Vec::new(),
            files: Vec::new(),
        };
        // Magnet whose metadata isn't resolved yet: nothing more is known.
        let _ = handle.with_metadata(|m| {
            let lengths = m.info.lengths();
            details.piece_size = Some(lengths.default_piece_length() as u64);
            details.pieces = Some(lengths.total_pieces());
            let (created_by, comment, created_at, trackers) = meta_fields(&m.torrent_bytes);
            details.created_by = created_by;
            details.comment = comment;
            details.created_at = created_at;
            details.trackers = trackers
                .into_iter()
                .map(|url| Tracker {
                    url,
                    status: None,
                    last_announce: None,
                    next_announce: None,
                    seeds: None,
                    peers: None,
                })
                .collect();
            details.files = m
                .file_infos
                .iter()
                .enumerate()
                .map(|(i, f)| {
                    let done = progress.get(i).copied().unwrap_or(0);
                    FileInfo {
                        index: i as u32,
                        path: f.relative_filename.to_string_lossy().into_owned(),
                        size: f.len,
                        progress: if f.len == 0 {
                            1.0
                        } else {
                            done as f64 / f.len as f64
                        },
                        wanted: only.as_ref().is_none_or(|o| o.contains(&i)),
                        priority: Priority::Normal,
                    }
                })
                .collect();
        });
        Ok(details)
    }

    fn to_add(source: AddSource) -> EngineResult<AddTorrent<'static>> {
        Ok(match source {
            AddSource::Uri(uri) => AddTorrent::from_url(check_uri(&uri)?.to_string()),
            AddSource::Bytes(bytes) => AddTorrent::from_bytes(bytes),
        })
    }

    async fn list_only(&self, add: AddTorrent<'_>) -> EngineResult<ListOnlyResponse> {
        let opts = AddTorrentOptions {
            list_only: true,
            ..Default::default()
        };
        match self.session.add_torrent(add, Some(opts)).await {
            Ok(AddTorrentResponse::ListOnly(r)) => Ok(r),
            Ok(_) => Err(unavailable("unexpected add response for list-only")),
            Err(e) => Err(invalid(e)),
        }
    }

    async fn add_raw(
        &self,
        add: AddTorrent<'_>,
        opts: AddTorrentOptions,
    ) -> EngineResult<Arc<ManagedTorrent>> {
        match self
            .session
            .add_torrent(add, Some(opts))
            .await
            .map_err(invalid)?
        {
            AddTorrentResponse::Added(_, h) => Ok(h),
            AddTorrentResponse::AlreadyManaged(_, h) => Err(EngineError::Duplicate(format!(
                "torrent {:?} already added",
                h.info_hash()
            ))),
            AddTorrentResponse::ListOnly(_) => Err(unavailable("unexpected list-only response")),
        }
    }

    pub async fn add(&self, source: AddSource, opts: &AddOptions) -> EngineResult<String> {
        let mut add = Self::to_add(source)?;
        let subfolder = opts.create_subfolder.unwrap_or(true);
        // librqbit's own layout (session dir + name folder for multi-file) covers the
        // default; otherwise pick the exact output folder ourselves.
        let output_folder = match (opts.save_path.as_deref().map(PathBuf::from), subfolder) {
            (None, true) => None,
            (dir, false) => Some(dir.unwrap_or_else(|| self.download_dir.clone())),
            (Some(dir), true) => {
                // Need name + file count first; for magnets this resolves metadata once
                // and the real add below reuses the resulting .torrent bytes.
                let r = self.list_only(add).await?;
                let files = r.info.iter_file_details().count();
                let name = r.info.name().map(|n| n.into_owned());
                add = AddTorrent::from_bytes(r.torrent_bytes);
                Some(
                    match default_subfolder(name.as_deref(), files, r.info_hash) {
                        Some(sub) => dir.join(sub),
                        None => dir,
                    },
                )
            }
        };
        let h = self
            .add_raw(
                add,
                AddTorrentOptions {
                    paused: opts.paused.unwrap_or(false),
                    only_files: opts
                        .wanted_files
                        .as_ref()
                        .map(|w| w.iter().map(|&i| i as usize).collect()),
                    // Resume on top of data already on disk instead of refusing.
                    overwrite: true,
                    output_folder: output_folder.map(|p| p.to_string_lossy().into_owned()),
                    ..Default::default()
                },
            )
            .await?;
        let hash = h.info_hash();
        self.added_at.lock().unwrap().insert(hash, unix_now());
        Ok(format!("{hash:?}"))
    }

    pub async fn preview(&self, source: AddSource) -> EngineResult<Preview> {
        let r = self.list_only(Self::to_add(source)?).await?;
        let lengths = r.info.lengths();
        let (created_by, comment, created_at, trackers) = meta_fields(&r.torrent_bytes);
        Ok(Preview {
            id: format!("{:?}", r.info_hash),
            name: r
                .info
                .name()
                .map(|n| n.into_owned())
                .unwrap_or_else(|| format!("{:?}", r.info_hash)),
            size: lengths.total_length(),
            piece_size: lengths.default_piece_length() as u64,
            pieces: lengths.total_pieces(),
            created_at,
            created_by,
            comment,
            trackers,
            files: r
                .info
                .iter_file_details()
                .enumerate()
                .map(|(i, f)| PreviewFile {
                    index: i as u32,
                    path: f.filename.to_pathbuf().to_string_lossy().into_owned(),
                    size: f.len,
                })
                .collect(),
        })
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

    pub async fn peers(&self, id: &str) -> EngineResult<Vec<Peer>> {
        let handle = self.handle(id)?;
        // Not live (paused / checking): no connected peers.
        let Some(live) = handle.live() else {
            return Ok(Vec::new());
        };
        Ok(live
            .per_peer_stats_snapshot(Default::default())
            .peers
            .into_iter()
            .map(|(address, p)| Peer {
                address,
                client: p.client_name,
                country: None,
                progress: None,
                // librqbit keeps no per-peer rates.
                download_rate: 0,
                upload_rate: 0,
                flags: None,
                is_seed: false,
            })
            .collect())
    }

    pub async fn pieces(&self, id: &str) -> EngineResult<Pieces> {
        let handle = self.handle(id)?;
        let (bf, count) = self
            .api
            .api_dump_haves(TorrentIdOrHash::Hash(handle.info_hash()))
            .map_err(invalid)?;
        Ok(Pieces {
            count,
            bitfield: bf.as_raw_slice().to_vec(),
        })
    }

    /// Forget the torrent (data stays) and add it again from the same metadata.
    async fn readd(
        &self,
        handle: &ManagedTorrent,
        output_folder: &Path,
        paused: bool,
    ) -> EngineResult<()> {
        let bytes = handle
            .with_metadata(|m| m.torrent_bytes.clone())
            .map_err(invalid)?;
        let only_files = handle.only_files();
        self.session
            .delete(TorrentIdOrHash::Hash(handle.info_hash()), false)
            .await
            .map_err(unavailable)?;
        self.add_raw(
            AddTorrent::from_bytes(bytes),
            AddTorrentOptions {
                paused,
                only_files,
                overwrite: true,
                output_folder: Some(output_folder.to_string_lossy().into_owned()),
                ..Default::default()
            },
        )
        .await
        .map(drop)
    }

    /// Server-assisted: forgetting drops the fastresume bitfield, so the re-add
    /// hashes everything on disk again.
    pub async fn verify(&self, id: &str) -> EngineResult<()> {
        let handle = self.handle(id)?;
        let out = handle.output_folder().to_path_buf();
        self.readd(&handle, &out, handle.is_paused()).await
    }

    /// Server-assisted: forget, move the files, re-add at the new place (re-checked,
    /// so progress is kept). `path` is the new save path; a torrent-name subfolder
    /// is carried over.
    pub async fn relocate(&self, id: &str, path: &str) -> EngineResult<()> {
        let handle = self.handle(id)?;
        let path = PathBuf::from(path);
        if !path.is_absolute() {
            return Err(invalid(format!("not an absolute path: {}", path.display())));
        }
        let from = handle.output_folder().to_path_buf();
        let to = match split_output(&handle).1 {
            Some(sub) => path.join(sub),
            None => path,
        };
        if from == to {
            return Ok(());
        }
        let files: Vec<PathBuf> = handle
            .with_metadata(|m| {
                m.file_infos
                    .iter()
                    .map(|f| f.relative_filename.clone())
                    .collect()
            })
            .map_err(invalid)?;
        // Stop it first so no file handles are open while moving.
        let paused = handle.is_paused();
        self.pause(id).await?;
        let (f, t) = (from.clone(), to.clone());
        let moved = tokio::task::spawn_blocking(move || move_files(&f, &t, &files))
            .await
            .map_err(unavailable)?;
        if let Err(e) = moved {
            // Files are back where they were; restore the torrent's state.
            if !paused {
                let _ = self.resume(id).await;
            }
            return Err(unavailable(format!(
                "cannot move data to {}: {e}",
                to.display()
            )));
        }
        self.readd(&handle, &to, paused).await
    }

    pub async fn rename(&self, _id: &str, _name: &str) -> EngineResult<()> {
        Err(unsupported("rename"))
    }

    pub async fn add_tracker(&self, _id: &str, _url: &str) -> EngineResult<()> {
        Err(unsupported("adding trackers"))
    }

    pub async fn set_files(
        &self,
        id: &str,
        indices: &[u32],
        wanted: Option<bool>,
        priority: Option<Priority>,
    ) -> EngineResult<()> {
        if priority.is_some_and(|p| p != Priority::Normal) {
            return Err(unsupported("file priority"));
        }
        let handle = self.handle(id)?;
        let Some(wanted) = wanted else {
            return Ok(());
        };
        let count = handle
            .with_metadata(|m| m.file_infos.len())
            .map_err(invalid)?;
        if let Some(&bad) = indices.iter().find(|&&i| i as usize >= count) {
            return Err(invalid(format!("no file with index {bad}")));
        }
        let mut only: HashSet<usize> = handle
            .only_files()
            .map(|o| o.into_iter().collect())
            .unwrap_or_else(|| (0..count).collect());
        for &i in indices {
            if wanted {
                only.insert(i as usize);
            } else {
                only.remove(&(i as usize));
            }
        }
        self.session
            .update_only_files(&handle, &only)
            .await
            .map_err(invalid)
    }

    pub async fn torrent_file(&self, id: &str) -> EngineResult<Vec<u8>> {
        self.handle(id)?
            .with_metadata(|m| m.torrent_bytes.to_vec())
            .map_err(invalid)
    }

    /// Rate limits apply live; listen port, UPnP, DHT and proxy need a new session.
    pub async fn apply_settings(&self, tuning: &EngineTuning) -> EngineResult<bool> {
        let l = limits(tuning);
        self.session.ratelimits.set_upload_bps(l.upload_bps);
        self.session.ratelimits.set_download_bps(l.download_bps);
        Ok(restart_key(tuning) != self.restart_key)
    }

    pub async fn session_totals(&self) -> EngineResult<(u64, u64)> {
        let c = self.api.api_session_stats().counters;
        Ok((c.fetched_bytes, c.uploaded_bytes))
    }

    pub async fn shutdown(&self) {
        self.session.stop().await;
    }
}

#[cfg(test)]
mod tests;
