//! Engine-agnostic torrent model shared by every TorrentX engine and the server.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Status {
    Downloading,
    Seeding,
    Paused,
    Checking,
    Queued,
    Error,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Torrent {
    /// Lowercase hex info-hash; stable across engines and restarts.
    pub id: String,
    pub name: String,
    pub size: u64,
    /// 0.0..=1.0
    pub progress: f64,
    pub download_rate: u64,
    pub upload_rate: u64,
    pub peers: u32,
    pub seeds: u32,
    pub status: Status,
    pub error: Option<String>,
    pub eta_secs: Option<u64>,
    /// Unix seconds.
    pub added_at: i64,
    pub save_path: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub path: String,
    pub size: u64,
    pub progress: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentDetails {
    #[serde(flatten)]
    pub torrent: Torrent,
    pub files: Vec<FileInfo>,
}

/// What to add: a magnet URI / http(s) URL to a .torrent, or raw .torrent bytes.
#[derive(Debug, Clone)]
pub enum AddSource {
    Uri(String),
    Bytes(Vec<u8>),
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum EngineError {
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    InvalidInput(String),
    #[error("{0}")]
    Duplicate(String),
    #[error("{0}")]
    Unavailable(String),
}

impl EngineError {
    /// Stable machine-readable kind used in API error bodies.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "not_found",
            Self::InvalidInput(_) => "invalid_input",
            Self::Duplicate(_) => "duplicate",
            Self::Unavailable(_) => "engine_unavailable",
        }
    }
}

pub type EngineResult<T> = Result<T, EngineError>;

/// Validates a user-supplied torrent id (40 hex chars) and lowercases it.
pub fn parse_id(id: &str) -> EngineResult<String> {
    if id.len() == 40 && id.bytes().all(|b| b.is_ascii_hexdigit()) {
        Ok(id.to_ascii_lowercase())
    } else {
        Err(EngineError::NotFound(format!("torrent {id} not found")))
    }
}

/// Accepts only magnet / http(s) URIs. Engines would otherwise treat any other
/// string as a local file path on the engine's host.
pub fn check_uri(uri: &str) -> EngineResult<&str> {
    let uri = uri.trim();
    let lower = uri.to_ascii_lowercase();
    let ok = (lower.starts_with("magnet:?") && lower.contains("xt=urn:btih:"))
        || lower.starts_with("http://")
        || lower.starts_with("https://");
    if ok {
        Ok(uri)
    } else {
        Err(EngineError::InvalidInput(format!(
            "not a magnet link or http(s) URL: {uri}"
        )))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const FIXTURE: &str = include_str!("../tests/fixtures/torrent.json");

    #[test]
    fn fixture_round_trips() {
        let details: TorrentDetails = serde_json::from_str(FIXTURE).unwrap();
        assert_eq!(details.torrent.status, Status::Downloading);
        assert_eq!(details.files.len(), 1);
        let back: serde_json::Value = serde_json::to_value(&details).unwrap();
        let orig: serde_json::Value = serde_json::from_str(FIXTURE).unwrap();
        assert_eq!(back, orig);
    }

    #[test]
    fn parse_id_rules() {
        let id = "A".repeat(40);
        assert_eq!(parse_id(&id).unwrap(), "a".repeat(40));
        assert_eq!(parse_id("123").unwrap_err().kind(), "not_found");
    }

    #[test]
    fn check_uri_rules() {
        assert!(check_uri("magnet:?xt=urn:btih:abc").is_ok());
        assert!(check_uri(" https://x/y.torrent ").is_ok());
        assert_eq!(
            check_uri("not-a-magnet").unwrap_err().kind(),
            "invalid_input"
        );
        assert!(check_uri("/etc/passwd").is_err());
        assert!(check_uri("file:///etc/passwd").is_err());
    }
}
