//! Engine-facing settings sections, shared by the server config and the engines.

use serde::{Deserialize, Serialize};

use crate::Priority;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ProxyKind {
    #[default]
    None,
    Http,
    Socks4,
    Socks5,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct ProxySettings {
    #[serde(rename = "type")]
    pub kind: ProxyKind,
    pub host: String,
    pub port: u16,
    pub auth_required: bool,
    pub username: String,
    /// Stored in the config file; never returned by the API.
    pub password: String,
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self {
            kind: ProxyKind::None,
            host: String::new(),
            port: 1080,
            auth_required: false,
            username: String::new(),
            password: String::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct NetworkSettings {
    /// 0 = engine default.
    pub max_connections_per_torrent: u32,
    /// KB/s, 0 = unlimited.
    #[serde(rename = "maxUploadKBps")]
    pub max_upload_kbps: u32,
    #[serde(rename = "maxDownloadKBps")]
    pub max_download_kbps: u32,
    /// 0 = engine default.
    pub listen_port: u16,
    pub upnp: bool,
    pub proxy: ProxySettings,
}

impl Default for NetworkSettings {
    fn default() -> Self {
        Self {
            max_connections_per_torrent: 0,
            max_upload_kbps: 0,
            max_download_kbps: 0,
            listen_port: 0,
            upnp: true,
            proxy: ProxySettings::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct DownloadSettings {
    /// Empty = the engine's own download directory.
    pub default_save_path: String,
    pub create_subfolder: bool,
    pub move_completed_enabled: bool,
    pub move_completed_path: String,
    /// 0 = unlimited.
    pub max_active_downloads: u32,
    pub max_active_torrents: u32,
    pub start_automatically: bool,
    pub default_priority: Priority,
    pub seed_automatically: bool,
    /// 0 = no limit.
    pub min_ratio: f64,
    pub min_seeding_minutes: u32,
}

impl Default for DownloadSettings {
    fn default() -> Self {
        Self {
            default_save_path: String::new(),
            create_subfolder: true,
            move_completed_enabled: false,
            move_completed_path: String::new(),
            max_active_downloads: 0,
            max_active_torrents: 0,
            start_automatically: true,
            default_priority: Priority::Normal,
            seed_automatically: true,
            min_ratio: 0.0,
            min_seeding_minutes: 0,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct AdvancedSettings {
    /// MB, 0 = engine default.
    #[serde(rename = "diskCacheMB")]
    pub disk_cache_mb: u32,
    pub os_cache: bool,
    pub super_seeding: bool,
    pub dht: bool,
    pub pex: bool,
    pub lpd: bool,
    pub anonymous_mode: bool,
    pub sequential_download: bool,
    pub web_socket_trackers: bool,
}

impl Default for AdvancedSettings {
    fn default() -> Self {
        Self {
            disk_cache_mb: 0,
            os_cache: true,
            super_seeding: false,
            dht: true,
            pex: true,
            lpd: true,
            anonymous_mode: false,
            sequential_download: false,
            web_socket_trackers: false,
        }
    }
}

/// Everything an engine needs to apply live.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct EngineTuning {
    pub network: NetworkSettings,
    pub downloads: DownloadSettings,
    pub advanced: AdvancedSettings,
}
