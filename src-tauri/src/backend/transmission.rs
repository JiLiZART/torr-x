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
    arguments: Option<serde_json::Value>,
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
            "paused": false
        });
        
        let response = self.send_request("torrent-add", args).await?;
        // Parse response and extract torrent ID
        // This is simplified - you'll need to handle the actual response format
        Ok("temp-id".to_string())
    }

    async fn get_torrents(&self) -> Result<Vec<TorrentInfo>, Box<dyn Error>> {
        let args = serde_json::json!({
            "fields": [
                "id", "name", "totalSize", "percentDone",
                "rateDownload", "rateUpload", "peersConnected",
                "seedsConnected", "status", "errorString"
            ]
        });

        let response = self.send_request("torrent-get", args).await?;
        // Parse response into TorrentInfo structs
        // This is simplified - you'll need to handle the actual response format
        Ok(vec![])
    }

    // Implement other TorrentBackend trait methods...
}