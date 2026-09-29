//! Transmission RPC engine for TorrentX.

use std::collections::HashSet;
use std::net::{IpAddr, SocketAddr};
use std::time::Duration;

use base64::Engine as _;
use reqwest::{Client, StatusCode};
use serde::{Deserialize, de::DeserializeOwned};
use serde_json::{Value, json};
use tokio::sync::{Mutex, OnceCell};
use torrentx_core::{
    AddOptions, AddSource, Capabilities, DownloadSettings, EngineError, EngineResult, EngineTuning,
    FileInfo, Peer, Pieces, Preview, PreviewFile, Priority, Status, Torrent, TorrentDetails,
    Tracker, check_uri, parse_id,
};

const ENGINE: &str = "transmission";
const SESSION_HEADER: &str = "X-Transmission-Session-Id";
const METADATA_TIMEOUT: Duration = Duration::from_secs(30);

const LIST_FIELDS: &[&str] = &[
    "hashString",
    "name",
    "totalSize",
    "percentDone",
    "rateDownload",
    "rateUpload",
    "peersConnected",
    "peersSendingToUs",
    "status",
    "error",
    "errorString",
    "eta",
    "addedDate",
    "downloadDir",
    "downloadedEver",
    "uploadedEver",
    "uploadRatio",
    "sizeWhenDone",
    "bandwidthPriority",
];

const DETAIL_FIELDS: &[&str] = &[
    "pieceSize",
    "pieceCount",
    "creator",
    "comment",
    "dateCreated",
    "corruptEver",
    "desiredAvailable",
    "leftUntilDone",
    "trackerStats",
    "files",
    "fileStats",
];

pub struct TransmissionEngine {
    client: Client,
    url: String,
    auth: Option<(String, String)>,
    session_id: Mutex<Option<String>>,
    rpc_version: OnceCell<i64>,
    /// Last applied download settings; `add` needs the move-completed target.
    downloads: std::sync::Mutex<DownloadSettings>,
}

#[derive(Deserialize)]
struct RpcResponse {
    result: String,
    #[serde(default)]
    arguments: Value,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawTorrent {
    hash_string: String,
    name: String,
    total_size: u64,
    percent_done: f64,
    rate_download: u64,
    rate_upload: u64,
    peers_connected: u32,
    peers_sending_to_us: u32,
    status: i64,
    error: i64,
    error_string: String,
    eta: i64,
    added_date: i64,
    download_dir: String,
    downloaded_ever: u64,
    uploaded_ever: u64,
    upload_ratio: f64,
    size_when_done: u64,
    bandwidth_priority: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawDetails {
    #[serde(flatten)]
    base: RawTorrent,
    piece_size: u64,
    piece_count: u32,
    creator: String,
    comment: String,
    date_created: i64,
    corrupt_ever: u64,
    desired_available: u64,
    left_until_done: u64,
    tracker_stats: Vec<RawTracker>,
    files: Vec<RawFile>,
    file_stats: Vec<RawFileStat>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawFile {
    name: String,
    length: u64,
    bytes_completed: u64,
}

#[derive(Deserialize)]
struct RawFileStat {
    /// 0/1 up to 4.0.1 and again from 4.0.2; bool in 4.0.0/4.0.1 and 4.1+.
    wanted: Value,
    priority: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawTracker {
    announce: String,
    announce_state: i64,
    has_announced: bool,
    last_announce_succeeded: bool,
    last_announce_result: String,
    last_announce_time: i64,
    next_announce_time: i64,
    seeder_count: i64,
    leecher_count: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPeer {
    address: String,
    port: u16,
    client_name: String,
    progress: f64,
    rate_to_client: u64,
    rate_to_peer: u64,
    flag_str: String,
}

/// Maps Transmission's `status` (0..=6) and `error` codes to the shared model.
pub fn map_status(status: i64, error: i64) -> Status {
    if error != 0 {
        return Status::Error;
    }
    match status {
        0 => Status::Paused,
        1 | 2 => Status::Checking,
        3 | 5 => Status::Queued,
        4 => Status::Downloading,
        6 => Status::Seeding,
        _ => Status::Error,
    }
}

/// tr_priority_t: -1 low, 0 normal, 1 high.
fn map_priority(p: i64) -> Priority {
    match p {
        i64::MIN..=-1 => Priority::Low,
        0 => Priority::Normal,
        _ => Priority::High,
    }
}

fn priority_num(p: Priority) -> i64 {
    match p {
        Priority::Low => -1,
        Priority::Normal => 0,
        Priority::High => 1,
    }
}

fn non_empty(s: String) -> Option<String> {
    (!s.is_empty()).then_some(s)
}

/// Transmission uses 0 for "never" and -1 for "unknown".
fn positive(n: i64) -> Option<i64> {
    (n > 0).then_some(n)
}

fn count(n: i64) -> Option<u32> {
    u32::try_from(n).ok()
}

/// Capability matrix for a daemon speaking `rpc-version` `rpc`.
pub fn capabilities_for(rpc: i64) -> Capabilities {
    let c = Capabilities::new(ENGINE)
        .engine(&[
            "fileSkip",
            "filePriority",
            "verify",
            "relocate",
            "rename",
            "addTracker",
            "trackerStatus",
            "peerList",
            "peerClient",
            "pieces",
            "torrentPriority",
            "speedLimits",
            "maxConnectionsPerTorrent",
            "listenPort",
            "upnp",
            "queue",
            "seedLimits",
            "moveCompleted",
            "diskCache",
            "dht",
            "pex",
            "lpd",
        ])
        .server(&["addPreview", "torrentFile"])
        .note("seedLimits", "seeding time enforced by TorrentX");
    // `sequential_download` arrived with Transmission 4.1 (rpc-version 18).
    if rpc >= 18 {
        c.engine(&["sequentialDownload"])
    } else {
        c
    }
}

fn tracker_status(t: &RawTracker) -> String {
    match t.announce_state {
        3 => "announcing".into(),
        _ if t.has_announced && t.last_announce_succeeded => "working".into(),
        _ if t.has_announced && !t.last_announce_result.is_empty() => {
            t.last_announce_result.clone()
        }
        _ if t.has_announced => "error".into(),
        0 => "inactive".into(),
        _ => "not contacted".into(),
    }
}

impl RawTracker {
    fn into_tracker(self) -> Tracker {
        Tracker {
            status: Some(tracker_status(&self)),
            last_announce: positive(self.last_announce_time),
            next_announce: positive(self.next_announce_time),
            seeds: count(self.seeder_count),
            peers: count(self.leecher_count),
            url: self.announce,
        }
    }
}

impl RawPeer {
    fn into_peer(self) -> Peer {
        let address = match self.address.parse::<IpAddr>() {
            Ok(ip) => SocketAddr::new(ip, self.port).to_string(),
            Err(_) => self.address,
        };
        Peer {
            address,
            client: non_empty(self.client_name),
            country: None,
            progress: Some(self.progress),
            download_rate: self.rate_to_client,
            upload_rate: self.rate_to_peer,
            flags: non_empty(self.flag_str),
            is_seed: self.progress >= 1.0,
        }
    }
}

impl RawTorrent {
    fn into_torrent(self) -> Torrent {
        Torrent {
            status: map_status(self.status, self.error),
            id: self.hash_string,
            name: self.name,
            size: self.total_size,
            progress: self.percent_done,
            download_rate: self.rate_download,
            upload_rate: self.rate_upload,
            peers: self.peers_connected,
            seeds: self.peers_sending_to_us,
            error: (self.error != 0).then_some(self.error_string),
            eta_secs: u64::try_from(self.eta).ok(),
            added_at: self.added_date,
            save_path: self.download_dir,
            downloaded: self.downloaded_ever,
            uploaded: self.uploaded_ever,
            // -1 = nothing downloaded, -2 = infinite.
            ratio: (self.upload_ratio >= 0.0).then_some(self.upload_ratio),
            wanted_size: self.size_when_done,
            tab_id: None,
            priority: map_priority(self.bandwidth_priority),
        }
    }
}

impl RawDetails {
    fn into_details(self) -> TorrentDetails {
        let files = self
            .files
            .into_iter()
            .enumerate()
            .map(|(i, f)| {
                let stat = self.file_stats.get(i);
                FileInfo {
                    index: i as u32,
                    progress: if f.length == 0 {
                        1.0
                    } else {
                        f.bytes_completed as f64 / f.length as f64
                    },
                    path: f.name,
                    size: f.length,
                    wanted: stat.is_none_or(|s| s.wanted.as_bool() == Some(true) || s.wanted == 1),
                    priority: stat.map_or(Priority::Normal, |s| map_priority(s.priority)),
                }
            })
            .collect();
        let want = self.base.size_when_done;
        // Share of wanted data that we have or peers offer (Transmission's "availability").
        let availability = (want > 0).then(|| {
            let have = want.saturating_sub(self.left_until_done);
            ((have + self.desired_available) as f64 / want as f64).min(1.0)
        });
        let has_meta = self.piece_count > 0;
        TorrentDetails {
            torrent: self.base.into_torrent(),
            piece_size: has_meta.then_some(self.piece_size),
            pieces: has_meta.then_some(self.piece_count),
            availability,
            wasted: Some(self.corrupt_ever),
            created_by: non_empty(self.creator),
            comment: non_empty(self.comment),
            created_at: positive(self.date_created),
            trackers: self
                .tracker_stats
                .into_iter()
                .map(RawTracker::into_tracker)
                .collect(),
            files,
        }
    }
}

fn decode_pieces(b64: &str, count: u32) -> EngineResult<Pieces> {
    let bitfield = base64::engine::general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| EngineError::Unavailable(format!("invalid Transmission piece map: {e}")))?;
    Ok(Pieces { count, bitfield })
}

fn source_args(source: &AddSource) -> EngineResult<Value> {
    Ok(match source {
        AddSource::Uri(uri) => json!({ "filename": check_uri(uri)? }),
        AddSource::Bytes(bytes) => json!({
            "metainfo": base64::engine::general_purpose::STANDARD.encode(bytes)
        }),
    })
}

/// `session-set` arguments for the given tuning. 0 ("engine default") maps to
/// Transmission's own defaults so switching back to 0 actually resets.
fn session_args(t: &EngineTuning, rpc: i64) -> Value {
    let (n, d, a) = (&t.network, &t.downloads, &t.advanced);
    let or = |v: u32, default: u32| if v == 0 { default } else { v };
    let seed_slots = (d.max_active_downloads > 0 && d.max_active_torrents > 0)
        .then(|| d.max_active_torrents.saturating_sub(d.max_active_downloads));
    let mut s = json!({
        "speed-limit-down": n.max_download_kbps,
        "speed-limit-down-enabled": n.max_download_kbps > 0,
        "speed-limit-up": n.max_upload_kbps,
        "speed-limit-up-enabled": n.max_upload_kbps > 0,
        "peer-limit-per-torrent": or(n.max_connections_per_torrent, 50),
        "peer-port": or(n.listen_port.into(), 51413),
        "port-forwarding-enabled": n.upnp,
        "download-queue-enabled": d.max_active_downloads > 0,
        "seed-queue-enabled": seed_slots.is_some(),
        "seedRatioLimited": d.min_ratio > 0.0,
        "cache-size-mb": or(a.disk_cache_mb, 4),
        "dht-enabled": a.dht,
        "pex-enabled": a.pex,
        "lpd-enabled": a.lpd,
    });
    if d.max_active_downloads > 0 {
        s["download-queue-size"] = json!(d.max_active_downloads);
    }
    if let Some(slots) = seed_slots {
        s["seed-queue-size"] = json!(slots);
    }
    if d.min_ratio > 0.0 {
        s["seedRatioLimit"] = json!(d.min_ratio);
    }
    // Move-completed = incomplete-dir inversion: downloads live in the default
    // save path (incomplete-dir) and move to download-dir when done.
    let moving = d.move_completed_enabled && !d.move_completed_path.is_empty();
    s["incomplete-dir-enabled"] = json!(moving);
    if moving {
        s["download-dir"] = json!(d.move_completed_path);
        if !d.default_save_path.is_empty() {
            s["incomplete-dir"] = json!(d.default_save_path);
        }
    } else if !d.default_save_path.is_empty() {
        s["download-dir"] = json!(d.default_save_path);
    }
    if rpc >= 18 {
        s["sequential_download"] = json!(a.sequential_download);
    }
    s
}

impl TransmissionEngine {
    /// `username` empty means no RPC auth.
    pub fn new(url: &str, username: &str, password: &str) -> Self {
        Self {
            client: Client::new(),
            url: url.to_string(),
            auth: (!username.is_empty()).then(|| (username.to_string(), password.to_string())),
            session_id: Mutex::new(None),
            rpc_version: OnceCell::new(),
            downloads: std::sync::Mutex::new(DownloadSettings::default()),
        }
    }

    /// Checks the daemon is reachable and credentials work.
    pub async fn ping(&self) -> EngineResult<()> {
        self.call("session-get", json!({ "fields": ["version"] }))
            .await
            .map(|_| ())
    }

    async fn call(&self, method: &str, arguments: Value) -> EngineResult<Value> {
        self.rpc(method, arguments).await?.map_err(|result| {
            EngineError::Unavailable(format!("Transmission {method} failed: {result}"))
        })
    }

    /// Outer error: transport/auth failure. Inner error: RPC `result` string.
    async fn rpc(&self, method: &str, arguments: Value) -> EngineResult<Result<Value, String>> {
        let body = json!({ "method": method, "arguments": arguments });
        // One retry: the first request of a session gets 409 with the session id.
        for _ in 0..2 {
            let session = self.session_id.lock().await.clone().unwrap_or_default();
            let mut req = self
                .client
                .post(&self.url)
                .header(SESSION_HEADER, session)
                .json(&body);
            if let Some((u, p)) = &self.auth {
                req = req.basic_auth(u, Some(p));
            }
            let resp = req.send().await.map_err(|e| {
                EngineError::Unavailable(format!("cannot reach Transmission at {}: {e}", self.url))
            })?;
            match resp.status() {
                StatusCode::CONFLICT => {
                    let id = resp
                        .headers()
                        .get(SESSION_HEADER)
                        .and_then(|v| v.to_str().ok())
                        .map(str::to_string);
                    *self.session_id.lock().await = id;
                    continue;
                }
                StatusCode::UNAUTHORIZED => {
                    return Err(EngineError::Unavailable(
                        "Transmission authentication failed".into(),
                    ));
                }
                s if !s.is_success() => {
                    return Err(EngineError::Unavailable(format!(
                        "Transmission responded with HTTP {s}"
                    )));
                }
                _ => {}
            }
            let parsed: RpcResponse = resp.json().await.map_err(|e| {
                EngineError::Unavailable(format!("invalid Transmission response: {e}"))
            })?;
            return Ok(if parsed.result == "success" {
                Ok(parsed.arguments)
            } else {
                Err(parsed.result)
            });
        }
        Err(EngineError::Unavailable(
            "Transmission session handshake failed".into(),
        ))
    }

    /// Cached per engine instance; settings changes that swap the daemon recreate the engine.
    async fn rpc_version(&self) -> EngineResult<i64> {
        self.rpc_version
            .get_or_try_init(|| async {
                let s = self
                    .call("session-get", json!({ "fields": ["rpc-version"] }))
                    .await?;
                Ok(s["rpc-version"].as_i64().unwrap_or(0))
            })
            .await
            .copied()
    }

    pub async fn capabilities(&self) -> Capabilities {
        capabilities_for(self.rpc_version().await.unwrap_or(0))
    }

    async fn fetch<T: DeserializeOwned>(
        &self,
        id: Option<&str>,
        fields: &[&str],
    ) -> EngineResult<Vec<T>> {
        let mut args = json!({ "fields": fields });
        if let Some(id) = id {
            args["ids"] = json!([id]);
        }
        let out = self.call("torrent-get", args).await?;
        serde_json::from_value(out["torrents"].clone()).map_err(|e| {
            EngineError::Unavailable(format!("invalid Transmission torrent list: {e}"))
        })
    }

    async fn one<T: DeserializeOwned>(&self, id: &str, fields: &[&str]) -> EngineResult<T> {
        let id = parse_id(id)?;
        self.fetch(Some(&id), fields)
            .await?
            .into_iter()
            .next()
            .ok_or_else(|| EngineError::NotFound(format!("torrent {id} not found")))
    }

    pub async fn list(&self) -> EngineResult<Vec<Torrent>> {
        Ok(self
            .fetch::<RawTorrent>(None, LIST_FIELDS)
            .await?
            .into_iter()
            .map(RawTorrent::into_torrent)
            .collect())
    }

    pub async fn get(&self, id: &str) -> EngineResult<TorrentDetails> {
        let raw: RawDetails = self.one(id, &[LIST_FIELDS, DETAIL_FIELDS].concat()).await?;
        Ok(raw.into_details())
    }

    /// Returns the hash and whether the torrent already existed.
    async fn add_raw(&self, args: Value) -> EngineResult<(String, bool)> {
        // Transmission reports bad input (corrupt file, bad URL) as the result string.
        let out = self
            .rpc("torrent-add", args)
            .await?
            .map_err(EngineError::InvalidInput)?;
        let dup = out.get("torrent-duplicate").is_some();
        let key = if dup {
            "torrent-duplicate"
        } else {
            "torrent-added"
        };
        out[key]["hashString"]
            .as_str()
            .map(|h| (h.to_string(), dup))
            .ok_or_else(|| EngineError::Unavailable("Transmission did not return a hash".into()))
    }

    /// With move-completed on, torrents saved to the default path must target the
    /// completed dir; the daemon's incomplete-dir holds them until done.
    fn download_dir(&self, save_path: Option<&str>) -> Option<String> {
        let d = self.downloads.lock().unwrap();
        let is_default = save_path.is_none_or(|p| p == d.default_save_path);
        if d.move_completed_enabled && !d.move_completed_path.is_empty() && is_default {
            Some(d.move_completed_path.clone())
        } else {
            save_path.map(str::to_string)
        }
    }

    /// `create_subfolder` is ignored: Transmission always keeps the torrent's root folder.
    pub async fn add(&self, source: AddSource, opts: &AddOptions) -> EngineResult<String> {
        let mut args = source_args(&source)?;
        let paused = opts.paused.unwrap_or(false);
        // File selection needs metadata first, so hold the torrent until it is applied.
        args["paused"] = json!(paused || opts.wanted_files.is_some());
        if let Some(dir) = self.download_dir(opts.save_path.as_deref()) {
            args["download-dir"] = json!(dir);
        }
        if let Some(p) = opts.priority {
            args["bandwidthPriority"] = json!(priority_num(p));
        }
        let (id, dup) = self.add_raw(args).await?;
        if dup {
            return Err(EngineError::Duplicate(format!(
                "torrent {id} already added"
            )));
        }
        if let Some(wanted) = &opts.wanted_files {
            if let Err(e) = self.select_files(&id, wanted).await {
                let _ = self.remove(&id, true).await;
                return Err(e);
            }
            if !paused {
                self.resume(&id).await?;
            }
        }
        Ok(id)
    }

    async fn select_files(&self, id: &str, wanted: &[u32]) -> EngineResult<()> {
        self.wait_metadata(id).await?;
        let n = self.file_count(id).await?;
        if let Some(bad) = wanted.iter().find(|&&i| i >= n) {
            return Err(EngineError::InvalidInput(format!(
                "file index {bad} out of range"
            )));
        }
        let wanted: HashSet<_> = wanted.iter().collect();
        let unwanted: Vec<u32> = (0..n).filter(|i| !wanted.contains(i)).collect();
        self.set_files(id, &unwanted, Some(false), None).await
    }

    async fn wait_metadata(&self, id: &str) -> EngineResult<()> {
        let deadline = tokio::time::Instant::now() + METADATA_TIMEOUT;
        loop {
            let v: Value = self.one(id, &["metadataPercentComplete"]).await?;
            if v["metadataPercentComplete"]
                .as_f64()
                .is_some_and(|p| p >= 1.0)
            {
                return Ok(());
            }
            if tokio::time::Instant::now() >= deadline {
                return Err(EngineError::Unavailable(
                    "torrent metadata not received within 30 s".into(),
                ));
            }
            tokio::time::sleep(Duration::from_millis(250)).await;
        }
    }

    async fn file_count(&self, id: &str) -> EngineResult<u32> {
        let v: Value = self.one(id, &["files"]).await?;
        Ok(v["files"].as_array().map_or(0, Vec::len) as u32)
    }

    /// Adds paused, waits for metadata, reads it and removes the torrent again
    /// (an already present torrent is only read).
    pub async fn preview(&self, source: AddSource) -> EngineResult<Preview> {
        let mut args = source_args(&source)?;
        // Paused magnets never fetch metadata; a running one may grab a few pieces,
        // which the removal below deletes.
        let magnet = matches!(&source, AddSource::Uri(u) if u.trim().to_ascii_lowercase().starts_with("magnet:"));
        args["paused"] = json!(!magnet);
        let (id, dup) = self.add_raw(args).await?;
        if dup {
            return self.read_preview(&id).await;
        }
        let res = async {
            self.wait_metadata(&id).await?;
            self.read_preview(&id).await
        }
        .await;
        let _ = self.remove(&id, true).await;
        res
    }

    async fn read_preview(&self, id: &str) -> EngineResult<Preview> {
        let d = self.get(id).await?;
        Ok(Preview {
            id: d.torrent.id,
            name: d.torrent.name,
            size: d.torrent.size,
            piece_size: d.piece_size.unwrap_or(0),
            pieces: d.pieces.unwrap_or(0),
            created_at: d.created_at,
            created_by: d.created_by,
            comment: d.comment,
            trackers: d.trackers.into_iter().map(|t| t.url).collect(),
            files: d
                .files
                .into_iter()
                .map(|f| PreviewFile {
                    index: f.index,
                    path: f.path,
                    size: f.size,
                })
                .collect(),
        })
    }

    async fn action(&self, method: &str, id: &str, extra: Value) -> EngineResult<()> {
        // Transmission silently ignores unknown ids, so check existence first.
        let hash = parse_id(id)?;
        self.one::<Value>(&hash, &["id"]).await?;
        let mut args = json!({ "ids": [hash] });
        if let (Value::Object(a), Value::Object(e)) = (&mut args, extra) {
            a.extend(e);
        }
        self.call(method, args).await.map(|_| ())
    }

    pub async fn pause(&self, id: &str) -> EngineResult<()> {
        self.action("torrent-stop", id, json!({})).await
    }

    pub async fn resume(&self, id: &str) -> EngineResult<()> {
        self.action("torrent-start", id, json!({})).await
    }

    pub async fn remove(&self, id: &str, delete_data: bool) -> EngineResult<()> {
        self.action(
            "torrent-remove",
            id,
            json!({ "delete-local-data": delete_data }),
        )
        .await
    }

    pub async fn peers(&self, id: &str) -> EngineResult<Vec<Peer>> {
        #[derive(Deserialize)]
        struct R {
            peers: Vec<RawPeer>,
        }
        let r: R = self.one(id, &["peers"]).await?;
        Ok(r.peers.into_iter().map(RawPeer::into_peer).collect())
    }

    pub async fn pieces(&self, id: &str) -> EngineResult<Pieces> {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct R {
            pieces: String,
            piece_count: u32,
        }
        let r: R = self.one(id, &["pieces", "pieceCount"]).await?;
        decode_pieces(&r.pieces, r.piece_count)
    }

    pub async fn verify(&self, id: &str) -> EngineResult<()> {
        self.action("torrent-verify", id, json!({})).await
    }

    pub async fn relocate(&self, id: &str, path: &str) -> EngineResult<()> {
        if path.trim().is_empty() {
            return Err(EngineError::InvalidInput("empty location".into()));
        }
        self.action(
            "torrent-set-location",
            id,
            json!({ "location": path, "move": true }),
        )
        .await
    }

    /// Renames the torrent's root file/folder on disk.
    pub async fn rename(&self, id: &str, name: &str) -> EngineResult<()> {
        let hash = parse_id(id)?;
        let v: Value = self.one(&hash, &["name"]).await?;
        let args = json!({ "ids": [hash], "path": v["name"], "name": name });
        self.rpc("torrent-rename-path", args)
            .await?
            .map(|_| ())
            .map_err(EngineError::InvalidInput)
    }

    pub async fn add_tracker(&self, id: &str, url: &str) -> EngineResult<()> {
        let url = url.trim();
        let lower = url.to_ascii_lowercase();
        if !["http://", "https://", "udp://", "ws://", "wss://"]
            .iter()
            .any(|s| lower.starts_with(s))
        {
            return Err(EngineError::InvalidInput(format!(
                "not a tracker URL: {url}"
            )));
        }
        let hash = parse_id(id)?;
        let args = if self.rpc_version().await? >= 17 {
            let v: Value = self.one(&hash, &["trackerList"]).await?;
            let list = v["trackerList"].as_str().unwrap_or_default().trim_end();
            if list.lines().any(|l| l.trim() == url) {
                return Ok(());
            }
            // A blank line starts a new tier.
            let list = if list.is_empty() {
                url.to_string()
            } else {
                format!("{list}\n\n{url}")
            };
            json!({ "ids": [hash], "trackerList": list })
        } else {
            self.one::<Value>(&hash, &["id"]).await?;
            json!({ "ids": [hash], "trackerAdd": [url] })
        };
        self.rpc("torrent-set", args)
            .await?
            .map(|_| ())
            .map_err(EngineError::InvalidInput)
    }

    pub async fn set_files(
        &self,
        id: &str,
        indices: &[u32],
        wanted: Option<bool>,
        priority: Option<Priority>,
    ) -> EngineResult<()> {
        let hash = parse_id(id)?;
        let n = self.file_count(&hash).await?;
        if let Some(bad) = indices.iter().find(|&&i| i >= n) {
            return Err(EngineError::InvalidInput(format!(
                "file index {bad} out of range"
            )));
        }
        // An empty index list means "all files" to Transmission.
        if indices.is_empty() || (wanted.is_none() && priority.is_none()) {
            return Ok(());
        }
        let mut args = json!({ "ids": [hash] });
        if let Some(w) = wanted {
            args[if w { "files-wanted" } else { "files-unwanted" }] = json!(indices);
        }
        if let Some(p) = priority {
            let key = match p {
                Priority::High => "priority-high",
                Priority::Normal => "priority-normal",
                Priority::Low => "priority-low",
            };
            args[key] = json!(indices);
        }
        self.call("torrent-set", args).await.map(|_| ())
    }

    /// Only works when the daemon's torrent dir is readable from this process.
    pub async fn torrent_file(&self, id: &str) -> EngineResult<Vec<u8>> {
        let v: Value = self.one(id, &["torrentFile"]).await?;
        let path = v["torrentFile"].as_str().unwrap_or_default();
        tokio::fs::read(path).await.map_err(|_| {
            EngineError::unsupported(
                ENGINE,
                "reading this torrent's .torrent file (not accessible)",
            )
        })
    }

    /// Everything applies live; never needs a restart.
    pub async fn apply_settings(&self, tuning: &EngineTuning) -> EngineResult<bool> {
        let rpc = self.rpc_version().await?;
        self.call("session-set", session_args(tuning, rpc)).await?;
        if rpc >= 18 {
            // The session flag covers new adds; existing torrents are set individually (no ids = all).
            self.call(
                "torrent-set",
                json!({ "sequential_download": tuning.advanced.sequential_download }),
            )
            .await?;
        }
        *self.downloads.lock().unwrap() = tuning.downloads.clone();
        Ok(false)
    }

    /// Daemon's current-session byte counters.
    pub async fn session_totals(&self) -> EngineResult<(u64, u64)> {
        let s = self.call("session-stats", json!({})).await?;
        let c = &s["current-stats"];
        Ok((
            c["downloadedBytes"].as_u64().unwrap_or(0),
            c["uploadedBytes"].as_u64().unwrap_or(0),
        ))
    }

    /// Nothing to persist: the daemon owns all state.
    pub async fn shutdown(&self) {}
}

#[cfg(test)]
mod tests {
    use super::*;

    const TORRENT_GET: &str = include_str!("../tests/fixtures/torrent-get.json");

    #[test]
    fn status_mapping_covers_every_code() {
        assert_eq!(map_status(0, 0), Status::Paused);
        assert_eq!(map_status(1, 0), Status::Checking);
        assert_eq!(map_status(2, 0), Status::Checking);
        assert_eq!(map_status(3, 0), Status::Queued);
        assert_eq!(map_status(4, 0), Status::Downloading);
        assert_eq!(map_status(5, 0), Status::Queued);
        assert_eq!(map_status(6, 0), Status::Seeding);
        assert_eq!(map_status(99, 0), Status::Error);
        assert_eq!(map_status(4, 3), Status::Error);
    }

    #[test]
    fn negative_eta_is_unknown() {
        let raw: RawTorrent = serde_json::from_value(json!({
            "hashString": "a".repeat(40), "name": "x", "totalSize": 10,
            "percentDone": 0.5, "rateDownload": 1, "rateUpload": 0,
            "peersConnected": 1, "peersSendingToUs": 1, "status": 4,
            "error": 0, "errorString": "", "eta": -1, "addedDate": 0,
            "downloadDir": "/d", "downloadedEver": 0, "uploadedEver": 0,
            "uploadRatio": -1, "sizeWhenDone": 10, "bandwidthPriority": 0
        }))
        .unwrap();
        let t = raw.into_torrent();
        assert_eq!(t.eta_secs, None);
        assert_eq!(t.error, None);
        assert_eq!(t.ratio, None);
    }

    /// Recorded `torrent-get` response (Transmission 4.0.6) with list + detail fields.
    #[test]
    fn recorded_details_map_to_model() {
        let out: Value = serde_json::from_str(TORRENT_GET).unwrap();
        let raw: RawDetails =
            serde_json::from_value(out["arguments"]["torrents"][0].clone()).unwrap();
        let d = raw.into_details();
        let t = &d.torrent;
        assert_eq!(t.id, "c14331f3bdd54f0a6e393e867756f7fe332839d0");
        assert_eq!(t.save_path, "/srv/downloads");
        assert_eq!((t.peers, t.seeds), (4, 2));
        assert_eq!(t.status, Status::Downloading);
        assert_eq!(t.priority, Priority::High);
        assert_eq!(t.downloaded, 1500);
        assert_eq!(t.uploaded, 300);
        assert_eq!(t.ratio, Some(0.2));
        assert_eq!(t.wanted_size, 2048);
        assert_eq!(t.eta_secs, Some(120));
        assert_eq!(t.tab_id, None);
        assert_eq!(d.piece_size, Some(16384));
        assert_eq!(d.pieces, Some(1));
        assert_eq!(d.wasted, Some(0));
        assert_eq!(d.availability, Some(1.0));
        assert_eq!(d.created_by.as_deref(), Some("torrentx"));
        assert_eq!(d.comment, None);
        assert_eq!(d.created_at, Some(1700000000));

        let [a, b, c] = &d.files[..] else {
            panic!("3 files")
        };
        assert_eq!((a.index, a.wanted, a.priority), (0, true, Priority::Normal));
        assert_eq!((b.index, b.wanted, b.priority), (1, false, Priority::Low));
        assert_eq!((c.index, c.wanted, c.priority), (2, true, Priority::High));
        assert_eq!(a.path, "tx-fixture/a.txt");
        assert_eq!(a.progress, 0.5);

        let [ok, err, idle] = &d.trackers[..] else {
            panic!("3 trackers")
        };
        assert_eq!(ok.url, "udp://tracker.opentrackr.org:1337/announce");
        assert_eq!(ok.status.as_deref(), Some("working"));
        assert_eq!(ok.last_announce, Some(1700000100));
        assert_eq!(ok.next_announce, Some(1700001900));
        assert_eq!((ok.seeds, ok.peers), (Some(12), Some(3)));
        assert_eq!(err.status.as_deref(), Some("Connection failed"));
        assert_eq!((err.seeds, err.peers), (None, None));
        assert_eq!(idle.status.as_deref(), Some("inactive"));
        assert_eq!(idle.last_announce, None);
    }

    #[test]
    fn tracker_status_announcing_wins() {
        let raw: RawTracker = serde_json::from_value(json!({
            "announce": "http://t/a", "announceState": 3, "hasAnnounced": false,
            "lastAnnounceSucceeded": false, "lastAnnounceResult": "",
            "lastAnnounceTime": 0, "nextAnnounceTime": 0,
            "seederCount": -1, "leecherCount": -1
        }))
        .unwrap();
        assert_eq!(tracker_status(&raw), "announcing");
    }

    #[test]
    fn peer_mapping() {
        let raw: RawPeer = serde_json::from_value(json!({
            "address": "::1", "port": 51413, "clientName": "qBittorrent 4.6",
            "progress": 1, "rateToClient": 2048, "rateToPeer": 16,
            "flagStr": "DEX", "isEncrypted": true
        }))
        .unwrap();
        let p = raw.into_peer();
        assert_eq!(p.address, "[::1]:51413");
        assert_eq!(p.client.as_deref(), Some("qBittorrent 4.6"));
        assert_eq!((p.download_rate, p.upload_rate), (2048, 16));
        assert_eq!(p.flags.as_deref(), Some("DEX"));
        assert!(p.is_seed);
        assert_eq!(p.country, None);
    }

    #[test]
    fn pieces_decode_base64_bitfield() {
        let p = decode_pieces("wA==", 3).unwrap();
        assert_eq!(p.count, 3);
        assert_eq!(p.bitfield, vec![0b1100_0000]);
        assert!(decode_pieces("!!", 1).is_err());
    }

    #[test]
    fn capabilities_follow_rpc_version() {
        let c17 = capabilities_for(17);
        assert!(!c17.supports("sequentialDownload"));
        assert_eq!(c17.via("addPreview"), Some(torrentx_core::Via::Server));
        assert_eq!(c17.via("torrentFile"), Some(torrentx_core::Via::Server));
        assert_eq!(c17.via("filePriority"), Some(torrentx_core::Via::Engine));
        assert!(!c17.supports("proxySocks5"));
        assert_eq!(
            c17.features["seedLimits"].note.as_deref(),
            Some("seeding time enforced by TorrentX")
        );
        assert!(capabilities_for(18).supports("sequentialDownload"));
    }

    #[test]
    fn session_args_mapping() {
        let mut t = EngineTuning::default();
        let s = session_args(&t, 17);
        assert_eq!(s["peer-limit-per-torrent"], 50);
        assert_eq!(s["peer-port"], 51413);
        assert_eq!(s["cache-size-mb"], 4);
        assert_eq!(s["speed-limit-down-enabled"], false);
        assert_eq!(s["seed-queue-enabled"], false);
        assert_eq!(s["incomplete-dir-enabled"], false);
        assert!(s.get("download-dir").is_none());
        assert!(s.get("sequential_download").is_none());

        t.network.max_download_kbps = 500;
        t.downloads.max_active_downloads = 3;
        t.downloads.max_active_torrents = 5;
        t.downloads.min_ratio = 1.5;
        t.downloads.default_save_path = "/dl".into();
        t.downloads.move_completed_enabled = true;
        t.downloads.move_completed_path = "/done".into();
        t.advanced.sequential_download = true;
        let s = session_args(&t, 18);
        assert_eq!(s["speed-limit-down"], 500);
        assert_eq!(s["speed-limit-down-enabled"], true);
        assert_eq!(s["download-queue-size"], 3);
        assert_eq!(s["seed-queue-size"], 2);
        assert_eq!(s["seedRatioLimited"], true);
        assert_eq!(s["seedRatioLimit"], 1.5);
        assert_eq!(s["download-dir"], "/done");
        assert_eq!(s["incomplete-dir"], "/dl");
        assert_eq!(s["incomplete-dir-enabled"], true);
        assert_eq!(s["sequential_download"], true);
    }

    #[test]
    fn move_completed_redirects_default_adds() {
        let e = TransmissionEngine::new("http://127.0.0.1:1/transmission/rpc", "", "");
        assert_eq!(e.download_dir(None), None);
        {
            let mut d = e.downloads.lock().unwrap();
            d.default_save_path = "/dl".into();
            d.move_completed_enabled = true;
            d.move_completed_path = "/done".into();
        }
        assert_eq!(e.download_dir(None).as_deref(), Some("/done"));
        assert_eq!(e.download_dir(Some("/dl")).as_deref(), Some("/done"));
        assert_eq!(e.download_dir(Some("/other")).as_deref(), Some("/other"));
    }

    #[tokio::test]
    async fn unreachable_daemon_is_unavailable() {
        let e = TransmissionEngine::new("http://127.0.0.1:1/transmission/rpc", "", "");
        assert_eq!(e.list().await.unwrap_err().kind(), "engine_unavailable");
    }

    // ---- daemon tests: `TORRENTX_TEST_TRANSMISSION=http://127.0.0.1:19091/transmission/rpc
    // cargo test -p torrentx-transmission -- --ignored` ----

    const MAGNET: &str = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337";

    fn daemon() -> TransmissionEngine {
        let url =
            std::env::var("TORRENTX_TEST_TRANSMISSION").expect("set TORRENTX_TEST_TRANSMISSION");
        TransmissionEngine::new(&url, "", "")
    }

    /// Minimal 3-file .torrent (bogus piece hashes); `name` makes the info-hash unique.
    fn test_torrent(name: &str) -> Vec<u8> {
        let mut info = b"d5:filesl".to_vec();
        for f in ["a.txt", "b.txt", "c.txt"] {
            info.extend(format!("d6:lengthi1e4:pathl{}:{f}ee", f.len()).as_bytes());
        }
        info.extend(
            format!(
                "e4:name{}:{name}12:piece lengthi16384e6:pieces20:",
                name.len()
            )
            .as_bytes(),
        );
        info.extend([0u8; 20]);
        info.push(b'e');
        let mut t = b"d10:created by8:torrentx13:creation datei1700000000e4:info".to_vec();
        t.extend(info);
        t.push(b'e');
        t
    }

    async fn purge(e: &TransmissionEngine, name: &str) {
        for t in e.list().await.unwrap() {
            if t.name.starts_with(name) {
                let _ = e.remove(&t.id, true).await;
            }
        }
    }

    #[tokio::test]
    #[ignore]
    async fn daemon_lifecycle() {
        let e = daemon();
        e.ping().await.unwrap();
        // Leftover from an aborted earlier run.
        let _ = e
            .remove("08ada5a7a6183aae1e09d831df6748d566095a10", true)
            .await;
        let opts = AddOptions::default();
        assert_eq!(
            e.add(AddSource::Uri("not-a-magnet".into()), &opts)
                .await
                .unwrap_err()
                .kind(),
            "invalid_input"
        );
        assert_eq!(
            e.add(AddSource::Bytes(b"garbage".to_vec()), &opts)
                .await
                .unwrap_err()
                .kind(),
            "invalid_input"
        );
        let id = e.add(AddSource::Uri(MAGNET.into()), &opts).await.unwrap();
        assert_eq!(id, "08ada5a7a6183aae1e09d831df6748d566095a10");
        assert_eq!(
            e.add(AddSource::Uri(MAGNET.into()), &opts)
                .await
                .unwrap_err()
                .kind(),
            "duplicate"
        );
        assert!(e.list().await.unwrap().iter().any(|t| t.id == id));
        // The daemon applies start/stop asynchronously.
        let settle = async |want_paused: bool| {
            for _ in 0..20 {
                let paused = e.get(&id).await.unwrap().torrent.status == Status::Paused;
                if paused == want_paused {
                    return;
                }
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            panic!("status never became paused={want_paused}");
        };
        e.pause(&id).await.unwrap();
        settle(true).await;
        e.resume(&id).await.unwrap();
        settle(false).await;
        e.remove(&id, true).await.unwrap();
        assert_eq!(e.get(&id).await.unwrap_err().kind(), "not_found");
        assert_eq!(e.pause(&id).await.unwrap_err().kind(), "not_found");
    }

    #[tokio::test]
    #[ignore]
    async fn daemon_add_with_options_and_torrent_ops() {
        let e = daemon();
        purge(&e, "tx-opts").await;
        let dir = std::env::temp_dir().join("torrentx-tr-test");
        let opts = AddOptions {
            save_path: Some(dir.to_string_lossy().into()),
            paused: Some(true),
            priority: Some(Priority::High),
            wanted_files: Some(vec![0, 2]),
            ..Default::default()
        };
        let id = e
            .add(AddSource::Bytes(test_torrent("tx-opts")), &opts)
            .await
            .unwrap();
        let d = e.get(&id).await.unwrap();
        // A fresh add is briefly "checking" before settling as stopped.
        assert!(matches!(
            d.torrent.status,
            Status::Paused | Status::Checking
        ));
        assert_eq!(d.torrent.priority, Priority::High);
        assert_eq!(d.torrent.save_path, dir.to_string_lossy());
        // sizeWhenDone is piece-granular; the single piece spans all files.
        assert_eq!(d.torrent.wanted_size, 3);
        assert_eq!(d.created_by.as_deref(), Some("torrentx"));
        assert_eq!(d.created_at, Some(1700000000));
        assert_eq!(
            d.files.iter().map(|f| f.wanted).collect::<Vec<_>>(),
            [true, false, true]
        );

        e.set_files(&id, &[1], Some(true), Some(Priority::Low))
            .await
            .unwrap();
        e.set_files(&id, &[0], None, Some(Priority::High))
            .await
            .unwrap();
        let f = e.get(&id).await.unwrap().files;
        assert!(f[1].wanted);
        assert_eq!(
            f.iter().map(|f| f.priority).collect::<Vec<_>>(),
            [Priority::High, Priority::Low, Priority::Normal]
        );
        assert_eq!(
            e.set_files(&id, &[9], Some(true), None)
                .await
                .unwrap_err()
                .kind(),
            "invalid_input"
        );

        let p = e.pieces(&id).await.unwrap();
        assert_eq!(p.count, 1);
        assert_eq!(p.bitfield, vec![0]);
        assert!(e.peers(&id).await.unwrap().is_empty());
        assert!(e.torrent_file(&id).await.unwrap().starts_with(b"d"));

        e.add_tracker(&id, "udp://tracker.example.org:6969/announce")
            .await
            .unwrap();
        e.add_tracker(&id, "udp://tracker.example.org:6969/announce")
            .await
            .unwrap();
        assert_eq!(
            e.add_tracker(&id, "nope").await.unwrap_err().kind(),
            "invalid_input"
        );
        assert_eq!(e.get(&id).await.unwrap().trackers.len(), 1);

        e.rename(&id, "tx-opts-renamed").await.unwrap();
        assert_eq!(e.get(&id).await.unwrap().torrent.name, "tx-opts-renamed");
        let moved = dir.join("moved");
        e.relocate(&id, &moved.to_string_lossy()).await.unwrap();
        assert_eq!(
            e.get(&id).await.unwrap().torrent.save_path,
            moved.to_string_lossy()
        );
        e.verify(&id).await.unwrap();
        e.remove(&id, true).await.unwrap();
    }

    #[tokio::test]
    #[ignore]
    async fn daemon_preview_leaves_nothing_behind() {
        let e = daemon();
        purge(&e, "tx-preview").await;
        let p = e
            .preview(AddSource::Bytes(test_torrent("tx-preview")))
            .await
            .unwrap();
        assert_eq!(p.name, "tx-preview");
        assert_eq!((p.pieces, p.piece_size, p.files.len()), (1, 16384, 3));
        assert_eq!(p.files[2].path, "tx-preview/c.txt");
        assert!(!e.list().await.unwrap().iter().any(|t| t.id == p.id));

        // An existing torrent is read, not removed.
        let id = e
            .add(
                AddSource::Bytes(test_torrent("tx-preview")),
                &AddOptions::default(),
            )
            .await
            .unwrap();
        assert_eq!(
            e.preview(AddSource::Bytes(test_torrent("tx-preview")))
                .await
                .unwrap()
                .id,
            id
        );
        assert!(e.get(&id).await.is_ok());
        e.remove(&id, true).await.unwrap();
    }

    /// Needs internet (DHT/tracker metadata fetch).
    #[tokio::test]
    #[ignore]
    async fn daemon_preview_magnet() {
        let e = daemon();
        let _ = e
            .remove("08ada5a7a6183aae1e09d831df6748d566095a10", true)
            .await;
        let p = e.preview(AddSource::Uri(MAGNET.into())).await.unwrap();
        assert_eq!(p.id, "08ada5a7a6183aae1e09d831df6748d566095a10");
        assert!(!p.files.is_empty());
        assert!(!e.list().await.unwrap().iter().any(|t| t.id == p.id));
    }

    #[tokio::test]
    #[ignore]
    async fn daemon_session_set_round_trip() {
        let e = daemon();
        let mut t = EngineTuning::default();
        t.network.max_download_kbps = 1234;
        t.network.max_connections_per_torrent = 77;
        t.network.listen_port = 51999;
        t.network.upnp = false;
        t.downloads.max_active_downloads = 2;
        t.downloads.max_active_torrents = 6;
        t.downloads.min_ratio = 2.5;
        t.advanced.disk_cache_mb = 16;
        t.advanced.pex = false;
        assert!(!e.apply_settings(&t).await.unwrap());
        let s = e.call("session-get", json!({})).await.unwrap();
        assert_eq!(s["speed-limit-down"], 1234);
        assert_eq!(s["speed-limit-down-enabled"], true);
        assert_eq!(s["speed-limit-up-enabled"], false);
        assert_eq!(s["peer-limit-per-torrent"], 77);
        assert_eq!(s["peer-port"], 51999);
        assert_eq!(s["port-forwarding-enabled"], false);
        assert_eq!(s["download-queue-enabled"], true);
        assert_eq!(s["download-queue-size"], 2);
        assert_eq!(s["seed-queue-size"], 4);
        assert_eq!(s["seedRatioLimited"], true);
        assert_eq!(s["seedRatioLimit"], 2.5);
        assert_eq!(s["cache-size-mb"], 16);
        assert_eq!(s["pex-enabled"], false);
        let (down, up) = e.session_totals().await.unwrap();
        assert!(down < u64::MAX && up < u64::MAX);
        // Back to defaults.
        e.apply_settings(&EngineTuning::default()).await.unwrap();
        let s = e.call("session-get", json!({})).await.unwrap();
        assert_eq!(s["peer-port"], 51413);
        assert_eq!(s["pex-enabled"], true);
    }
}
