//! Transmission RPC engine for TorrentX.

use base64::Engine as _;
use reqwest::{Client, StatusCode};
use serde::Deserialize;
use serde_json::{Value, json};
use tokio::sync::Mutex;
use torrentx_core::{
    AddSource, EngineError, EngineResult, FileInfo, Status, Torrent, TorrentDetails, check_uri,
    parse_id,
};

const SESSION_HEADER: &str = "X-Transmission-Session-Id";

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
];

pub struct TransmissionEngine {
    client: Client,
    url: String,
    auth: Option<(String, String)>,
    session_id: Mutex<Option<String>>,
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
    #[serde(default)]
    files: Vec<RawFile>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawFile {
    name: String,
    length: u64,
    bytes_completed: u64,
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

impl RawTorrent {
    fn into_torrent(self) -> (Torrent, Vec<RawFile>) {
        let status = map_status(self.status, self.error);
        let torrent = Torrent {
            id: self.hash_string,
            name: self.name,
            size: self.total_size,
            progress: self.percent_done,
            download_rate: self.rate_download,
            upload_rate: self.rate_upload,
            peers: self.peers_connected,
            seeds: self.peers_sending_to_us,
            status,
            error: (self.error != 0).then_some(self.error_string),
            eta_secs: u64::try_from(self.eta).ok(),
            added_at: self.added_date,
            save_path: self.download_dir,
        };
        (torrent, self.files)
    }
}

impl TransmissionEngine {
    /// `username` empty means no RPC auth.
    pub fn new(url: &str, username: &str, password: &str) -> Self {
        Self {
            client: Client::new(),
            url: url.to_string(),
            auth: (!username.is_empty()).then(|| (username.to_string(), password.to_string())),
            session_id: Mutex::new(None),
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

    async fn get_raw(&self, ids: Option<&str>, files: bool) -> EngineResult<Vec<RawTorrent>> {
        let mut fields = LIST_FIELDS.to_vec();
        if files {
            fields.push("files");
        }
        let mut args = json!({ "fields": fields });
        if let Some(id) = ids {
            args["ids"] = json!([id]);
        }
        let out = self.call("torrent-get", args).await?;
        serde_json::from_value(out["torrents"].clone()).map_err(|e| {
            EngineError::Unavailable(format!("invalid Transmission torrent list: {e}"))
        })
    }

    async fn one(&self, id: &str, files: bool) -> EngineResult<RawTorrent> {
        let id = parse_id(id)?;
        self.get_raw(Some(&id), files)
            .await?
            .into_iter()
            .next()
            .ok_or_else(|| EngineError::NotFound(format!("torrent {id} not found")))
    }

    pub async fn list(&self) -> EngineResult<Vec<Torrent>> {
        Ok(self
            .get_raw(None, false)
            .await?
            .into_iter()
            .map(|t| t.into_torrent().0)
            .collect())
    }

    pub async fn get(&self, id: &str) -> EngineResult<TorrentDetails> {
        let (torrent, files) = self.one(id, true).await?.into_torrent();
        let files = files
            .into_iter()
            .map(|f| FileInfo {
                progress: if f.length == 0 {
                    1.0
                } else {
                    f.bytes_completed as f64 / f.length as f64
                },
                path: f.name,
                size: f.length,
            })
            .collect();
        Ok(TorrentDetails { torrent, files })
    }

    pub async fn add(&self, source: AddSource) -> EngineResult<String> {
        let args = match &source {
            AddSource::Uri(uri) => json!({ "filename": check_uri(uri)? }),
            AddSource::Bytes(bytes) => json!({
                "metainfo": base64::engine::general_purpose::STANDARD.encode(bytes)
            }),
        };
        // Transmission reports bad input (corrupt file, bad URL) as the result string.
        let out = self
            .rpc("torrent-add", args)
            .await?
            .map_err(EngineError::InvalidInput)?;
        if let Some(dup) = out.get("torrent-duplicate") {
            return Err(EngineError::Duplicate(format!(
                "torrent {} already added",
                dup["hashString"].as_str().unwrap_or_default()
            )));
        }
        out["torrent-added"]["hashString"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| EngineError::Unavailable("Transmission did not return a hash".into()))
    }

    async fn action(&self, method: &str, id: &str, extra: Value) -> EngineResult<()> {
        // Transmission silently ignores unknown ids, so check existence first.
        let hash = self.one(id, false).await?.hash_string;
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

    /// Nothing to persist: the daemon owns all state.
    pub async fn shutdown(&self) {}
}

#[cfg(test)]
mod tests {
    use super::*;

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
            "downloadDir": "/d"
        }))
        .unwrap();
        let (t, _) = raw.into_torrent();
        assert_eq!(t.eta_secs, None);
        assert_eq!(t.error, None);
    }

    /// Needs a daemon: `TORRENTX_TEST_TRANSMISSION=http://127.0.0.1:19091/transmission/rpc
    /// cargo test -p torrentx-transmission -- --ignored`
    #[tokio::test]
    #[ignore]
    async fn daemon_lifecycle() {
        const MAGNET: &str = "magnet:?xt=urn:btih:08ada5a7a6183aae1e09d831df6748d566095a10&dn=Sintel&tr=udp%3A%2F%2Ftracker.opentrackr.org%3A1337";
        let url =
            std::env::var("TORRENTX_TEST_TRANSMISSION").expect("set TORRENTX_TEST_TRANSMISSION");
        let e = TransmissionEngine::new(&url, "", "");
        e.ping().await.unwrap();
        // Leftover from an aborted earlier run.
        let _ = e
            .remove("08ada5a7a6183aae1e09d831df6748d566095a10", true)
            .await;
        assert_eq!(
            e.add(AddSource::Uri("not-a-magnet".into()))
                .await
                .unwrap_err()
                .kind(),
            "invalid_input"
        );
        assert_eq!(
            e.add(AddSource::Bytes(b"garbage".to_vec()))
                .await
                .unwrap_err()
                .kind(),
            "invalid_input"
        );
        let id = e.add(AddSource::Uri(MAGNET.into())).await.unwrap();
        assert_eq!(id, "08ada5a7a6183aae1e09d831df6748d566095a10");
        assert_eq!(
            e.add(AddSource::Uri(MAGNET.into()))
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
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
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
    async fn unreachable_daemon_is_unavailable() {
        let e = TransmissionEngine::new("http://127.0.0.1:1/transmission/rpc", "", "");
        assert_eq!(e.list().await.unwrap_err().kind(), "engine_unavailable");
    }
}
