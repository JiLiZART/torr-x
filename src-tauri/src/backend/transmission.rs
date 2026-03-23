use crate::backend::{TorrentBackend, TorrentInfo, TorrentStatus};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::error::Error;

pub struct TransmissionRPC {
    client: Client,
    url: String,
    session_id: Option<String>,
}

#[derive(Debug, Serialize)]
struct TransmissionRequest {
    method: String,
    arguments: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct TransmissionResponse {
    result: String,
    arguments: Option<TransmissionArguments>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransmissionArguments {
    torrents: Option<Vec<TransmissionTorrent>>,
    torrent_added: Option<TransmissionTorrent>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TransmissionTorrent {
    id: i64,
    name: String,
    #[serde(rename = "totalSize")]
    size: i64,
    #[serde(rename = "percentDone")]
    progress: f64,
    #[serde(rename = "rateDownload")]
    download_speed: i64,
    #[serde(rename = "rateUpload")]
    upload_speed: i64,
    #[serde(rename = "peersConnected")]
    peers_connected: i32,
    #[serde(rename = "seedsConnected")]
    seeds_connected: i32,
    status: i32,
    #[serde(rename = "errorString")]
    error: Option<String>,
    added_date: i64,
    hash_string: String,
    download_dir: String,
    piece_count: i32,
    #[serde(rename = "pieceSize")]
    piece_size: i64,
    #[serde(rename = "metadataPercentComplete")]
    metadata_progress: f64,
    #[serde(rename = "uploadRatio")]
    ratio: f64,
    trackers: Vec<TransmissionTracker>,
    comment: String,
    #[serde(rename = "dateCreated")]
    date_created: i64,
}

#[derive(Debug, Deserialize)]
struct TransmissionTracker {
    announce: String,
    #[serde(rename = "scrape")]
    url: String,
    tier: i32,
}

impl TransmissionRPC {
    pub fn new(url: String) -> Self {
        Self {
            client: Client::new(),
            url,
            session_id: None,
        }
    }

    async fn send_request(&mut self, method: &str, args: serde_json::Value) -> Result<TransmissionResponse, Box<dyn Error>> {
        let request = TransmissionRequest {
            method: method.to_string(),
            arguments: args,
        };

        let mut response = self.client
            .post(&self.url)
            .header("X-Transmission-Session-Id", self.session_id.as_deref().unwrap_or(""))
            .json(&request)
            .send()
            .await?;

        // Handle session ID refresh if needed
        if response.status() == 409 {
            if let Some(new_session_id) = response.headers().get("X-Transmission-Session-Id") {
                self.session_id = Some(new_session_id.to_str()?.to_string());
                response = self.client
                    .post(&self.url)
                    .header("X-Transmission-Session-Id", self.session_id.as_ref().unwrap())
                    .json(&request)
                    .send()
                    .await?;
            }
        }

        Ok(response.json().await?)
    }
}

#[async_trait::async_trait]
impl TorrentBackend for TransmissionRPC {
    async fn add_torrent(&self, magnet_or_url: &str) -> Result<String, Box<dyn Error>> {
        let args = serde_json::json!({
            "filename": magnet_or_url,
            "paused": false,
            // Request all fields we'll need for the TorrentInfo
            "fields": [
                "id", "name", "totalSize", "percentDone",
                "rateDownload", "rateUpload", "peersConnected",
                "seedsConnected", "status", "errorString", "addedDate",
                "hashString", "downloadDir", "pieceCount", "pieceSize",
                "metadataPercentComplete", "uploadRatio", "trackers",
                "comment", "dateCreated"
            ]
        });
        
        let response = self.send_request("torrent-add", args).await?;
        
        if let Some(args) = response.arguments {
            if let Some(torrent) = args.torrent_added {
                return Ok(torrent.id.to_string());
            }
        }
        
        Err("Failed to add torrent".into())
    }

    async fn get_torrents(&self) -> Result<Vec<TorrentInfo>, Box<dyn Error>> {
        let args = serde_json::json!({
            "fields": [
                "id", "name", "totalSize", "percentDone",
                "rateDownload", "rateUpload", "peersConnected",
                "seedsConnected", "status", "errorString", "addedDate",
                "hashString", "downloadDir", "pieceCount", "pieceSize",
                "metadataPercentComplete", "uploadRatio", "trackers",
                "comment", "dateCreated"
            ]
        });

        let response = self.send_request("torrent-get", args).await?;
        
        if let Some(args) = response.arguments {
            if let Some(torrents) = args.torrents {
                return Ok(torrents.into_iter().map(|t| TorrentInfo {
                    id: t.id.to_string(),
                    name: t.name,
                    size: t.size as u64,
                    progress: (t.progress * 100.0) as f32,
                    download_speed: t.download_speed as u64,
                    upload_speed: t.upload_speed as u64,
                    peers_connected: t.peers_connected as u32,
                    seeds_connected: t.seeds_connected as u32,
                    status: match t.status {
                        0 => TorrentStatus::Paused,
                        1 => TorrentStatus::Checking,
                        2 => TorrentStatus::Downloading,
                        3 => TorrentStatus::Downloading, // Queued
                        4 => TorrentStatus::Seeding,
                        5 => TorrentStatus::Seeding,    // Queued for seeding
                        6 => TorrentStatus::Error,
                        _ => TorrentStatus::Error,
                    },
                    error: t.error,
                }).collect());
            }
        }
        
        Ok(vec![])
    }

    async fn pause_torrent(&self, id: &str) -> Result<(), Box<dyn Error>> {
        let args = serde_json::json!({
            "ids": [id.parse::<i64>()?]
        });
        
        self.send_request("torrent-stop", args).await?;
        Ok(())
    }

    async fn resume_torrent(&self, id: &str) -> Result<(), Box<dyn Error>> {
        let args = serde_json::json!({
            "ids": [id.parse::<i64>()?]
        });
        
        self.send_request("torrent-start", args).await?;
        Ok(())
    }

    async fn remove_torrent(&self, id: &str, delete_files: bool) -> Result<(), Box<dyn Error>> {
        let args = serde_json::json!({
            "ids": [id.parse::<i64>()?],
            "delete-local-data": delete_files
        });
        
        self.send_request("torrent-remove", args).await?;
        Ok(())
    }

    async fn get_torrent_info(&self, id: &str) -> Result<TorrentInfo, Box<dyn Error>> {
        let args = serde_json::json!({
            "ids": [id.parse::<i64>()?],
            "fields": [
                "id", "name", "totalSize", "percentDone",
                "rateDownload", "rateUpload", "peersConnected",
                "seedsConnected", "status", "errorString", "addedDate",
                "hashString", "downloadDir", "pieceCount", "pieceSize",
                "metadataPercentComplete", "uploadRatio", "trackers",
                "comment", "dateCreated"
            ]
        });

        let response = self.send_request("torrent-get", args).await?;
        
        if let Some(args) = response.arguments {
            if let Some(mut torrents) = args.torrents {
                if let Some(torrent) = torrents.pop() {
                    return Ok(TorrentInfo {
                        id: torrent.id.to_string(),
                        name: torrent.name,
                        size: torrent.size as u64,
                        progress: (torrent.progress * 100.0) as f32,
                        download_speed: torrent.download_speed as u64,
                        upload_speed: torrent.upload_speed as u64,
                        peers_connected: torrent.peers_connected as u32,
                        seeds_connected: torrent.seeds_connected as u32,
                        status: match torrent.status {
                            0 => TorrentStatus::Paused,
                            1 => TorrentStatus::Checking,
                            2 => TorrentStatus::Downloading,
                            3 => TorrentStatus::Downloading, // Queued
                            4 => TorrentStatus::Seeding,
                            5 => TorrentStatus::Seeding,    // Queued for seeding
                            6 => TorrentStatus::Error,
                            _ => TorrentStatus::Error,
                        },
                        error: torrent.error,
                    });
                }
            }
        }
        
        Err("Torrent not found".into())
    }
}