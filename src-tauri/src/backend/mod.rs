use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Debug, Serialize, Deserialize)]
pub struct TorrentInfo {
    pub id: String,
    pub name: String,
    pub size: u64,
    pub progress: f32,
    pub download_speed: u64,
    pub upload_speed: u64,
    pub peers_connected: u32,
    pub seeds_connected: u32,
    pub status: TorrentStatus,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum TorrentStatus {
    Downloading,
    Seeding,
    Paused,
    Checking,
    Error,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum Backend {
    Transmission,
    Internal,
}

pub trait TorrentBackend {
    fn add_torrent(&self, magnet_or_url: &str) -> Result<String, Box<dyn Error>>;
    fn remove_torrent(&self, id: &str, delete_files: bool) -> Result<(), Box<dyn Error>>;
    fn get_torrents(&self) -> Result<Vec<TorrentInfo>, Box<dyn Error>>;
    fn pause_torrent(&self, id: &str) -> Result<(), Box<dyn Error>>;
    fn resume_torrent(&self, id: &str) -> Result<(), Box<dyn Error>>;
    fn get_torrent_info(&self, id: &str) -> Result<TorrentInfo, Box<dyn Error>>;
}
