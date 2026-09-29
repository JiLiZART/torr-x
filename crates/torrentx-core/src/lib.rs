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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    #[default]
    Normal,
    High,
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
    /// Bytes downloaded / uploaded (engine lifetime where the engine keeps it).
    pub downloaded: u64,
    pub uploaded: u64,
    /// uploaded / downloaded; null when nothing was downloaded.
    pub ratio: Option<f64>,
    /// Bytes of the files that are wanted.
    pub wanted_size: u64,
    /// User tab; engines leave it null, the server fills it.
    pub tab_id: Option<String>,
    pub priority: Priority,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub index: u32,
    pub path: String,
    pub size: u64,
    pub progress: f64,
    pub wanted: bool,
    pub priority: Priority,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tracker {
    pub url: String,
    pub status: Option<String>,
    pub last_announce: Option<i64>,
    pub next_announce: Option<i64>,
    pub seeds: Option<u32>,
    pub peers: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentDetails {
    #[serde(flatten)]
    pub torrent: Torrent,
    pub piece_size: Option<u64>,
    pub pieces: Option<u32>,
    pub availability: Option<f64>,
    pub wasted: Option<u64>,
    pub created_by: Option<String>,
    pub comment: Option<String>,
    pub created_at: Option<i64>,
    pub trackers: Vec<Tracker>,
    pub files: Vec<FileInfo>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Peer {
    pub address: String,
    pub client: Option<String>,
    /// ISO 3166 code, filled by the server when GeoIP is available.
    pub country: Option<String>,
    pub progress: Option<f64>,
    pub download_rate: u64,
    pub upload_rate: u64,
    pub flags: Option<String>,
    pub is_seed: bool,
}

/// Piece bitfield, MSB-first per byte as in the BitTorrent protocol.
#[derive(Debug, Clone, PartialEq)]
pub struct Pieces {
    pub count: u32,
    pub bitfield: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewFile {
    pub index: u32,
    pub path: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub piece_size: u64,
    pub pieces: u32,
    pub created_at: Option<i64>,
    pub created_by: Option<String>,
    pub comment: Option<String>,
    pub trackers: Vec<String>,
    pub files: Vec<PreviewFile>,
}

/// Options for adding a torrent. Missing values mean "use the settings default".
#[derive(Debug, Clone, PartialEq, Default, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AddOptions {
    pub save_path: Option<String>,
    pub create_subfolder: Option<bool>,
    pub paused: Option<bool>,
    pub priority: Option<Priority>,
    /// File indices to download; None = all.
    pub wanted_files: Option<Vec<u32>>,
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
    #[error("{0}")]
    Unsupported(String),
}

impl EngineError {
    /// Stable machine-readable kind used in API error bodies.
    pub fn kind(&self) -> &'static str {
        match self {
            Self::NotFound(_) => "not_found",
            Self::InvalidInput(_) => "invalid_input",
            Self::Duplicate(_) => "duplicate",
            Self::Unavailable(_) => "engine_unavailable",
            Self::Unsupported(_) => "unsupported",
        }
    }
}

pub type EngineResult<T> = Result<T, EngineError>;

impl EngineError {
    pub fn unsupported(engine: &str, what: &str) -> Self {
        Self::Unsupported(format!("{what} is not supported by {engine}"))
    }
}

mod capabilities;
mod settings;
pub use capabilities::*;
pub use settings::*;

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
