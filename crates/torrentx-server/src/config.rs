//! TOML config file: load / validate / atomic save.

use std::net::{IpAddr, Ipv4Addr};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use torrentx_core::{AdvancedSettings, DownloadSettings, EngineTuning, NetworkSettings};

pub const DEFAULT_PORT: u16 = 9977;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(default, deny_unknown_fields)]
pub struct Config {
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub engine: EngineConfig,
    pub network: NetworkSettings,
    pub downloads: DownloadSettings,
    pub advanced: AdvancedSettings,
    pub preferences: Preferences,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum Language {
    #[default]
    En,
    Fr,
    De,
    Es,
    Ru,
    Zh,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "kebab-case")]
pub enum Theme {
    #[default]
    Hacker,
    DarkBlue,
    Light,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum DateFormat {
    #[default]
    Relative,
    Absolute,
    Iso,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Notifications {
    pub enabled: bool,
    pub on_complete: bool,
    pub on_add: bool,
    pub sound: bool,
}

impl Default for Notifications {
    fn default() -> Self {
        Self {
            enabled: true,
            on_complete: true,
            on_add: false,
            sound: false,
        }
    }
}

/// UI and desktop preferences; the server only stores them.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Preferences {
    pub start_with_system: bool,
    pub start_minimized: bool,
    pub confirm_exit_while_downloading: bool,
    pub check_for_updates: bool,
    pub language: Language,
    pub theme: Theme,
    pub use_system_theme: bool,
    pub show_speed_graph: bool,
    pub show_piece_map: bool,
    pub date_format: DateFormat,
    pub notifications: Notifications,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            start_with_system: false,
            start_minimized: false,
            confirm_exit_while_downloading: true,
            check_for_updates: true,
            language: Language::En,
            theme: Theme::Hacker,
            use_system_theme: false,
            show_speed_graph: true,
            show_piece_map: true,
            date_format: DateFormat::Relative,
            notifications: Notifications::default(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct ServerConfig {
    pub bind: IpAddr,
    pub port: u16,
    /// Extra Host header values accepted when bound to loopback.
    pub allowed_hosts: Vec<String>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            bind: IpAddr::V4(Ipv4Addr::LOCALHOST),
            port: DEFAULT_PORT,
            allowed_hosts: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(default, deny_unknown_fields)]
pub struct AuthConfig {
    pub enabled: bool,
    pub username: String,
    /// argon2id PHC string.
    pub password_hash: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum EngineKind {
    #[default]
    Rqbit,
    Transmission,
}

impl EngineKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Rqbit => "rqbit",
            Self::Transmission => "transmission",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(default, deny_unknown_fields)]
pub struct EngineConfig {
    pub kind: EngineKind,
    pub rqbit: RqbitConfig,
    pub transmission: TransmissionConfig,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct RqbitConfig {
    pub download_dir: PathBuf,
}

impl Default for RqbitConfig {
    fn default() -> Self {
        let downloads = directories::UserDirs::new()
            .and_then(|u| u.download_dir().map(Path::to_path_buf))
            .or_else(|| directories::BaseDirs::new().map(|b| b.home_dir().join("Downloads")))
            .unwrap_or_else(|| PathBuf::from("downloads"));
        Self {
            download_dir: downloads.join("TorrentX"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(default, deny_unknown_fields)]
pub struct TransmissionConfig {
    pub host: String,
    pub port: u16,
    pub path: String,
    pub https: bool,
    pub username: String,
    /// Plaintext: needed to call the RPC. The file is written with mode 0600.
    pub password: String,
    /// v1 config field, migrated into host/port/path/https on load.
    #[serde(skip_serializing)]
    pub url: Option<String>,
}

impl Default for TransmissionConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".into(),
            port: 9091,
            path: "/transmission/rpc".into(),
            https: false,
            username: String::new(),
            password: String::new(),
            url: None,
        }
    }
}

impl TransmissionConfig {
    pub fn rpc_url(&self) -> String {
        let scheme = if self.https { "https" } else { "http" };
        let host = if self.host.contains(':') && !self.host.starts_with('[') {
            format!("[{}]", self.host)
        } else {
            self.host.clone()
        };
        let path = if self.path.starts_with('/') {
            self.path.clone()
        } else {
            format!("/{}", self.path)
        };
        format!("{scheme}://{host}:{}{path}", self.port)
    }

    /// Parses a v1 `url` (`http[s]://host[:port][/path]`) into the split fields.
    fn migrate_url(&mut self, url: &str) -> Result<(), String> {
        let bad = || format!("invalid Transmission RPC URL {url:?}");
        let (https, rest) = if let Some(r) = url.strip_prefix("https://") {
            (true, r)
        } else if let Some(r) = url.strip_prefix("http://") {
            (false, r)
        } else {
            return Err(bad());
        };
        let (authority, path) = match rest.find('/') {
            Some(i) => (&rest[..i], &rest[i..]),
            None => (rest, "/transmission/rpc"),
        };
        let default_port = if https { 443 } else { 80 };
        // `[v6]:port`, `[v6]`, `host:port` or `host`.
        let (host, port) = match authority.strip_prefix('[') {
            Some(r) => {
                let (h, tail) = r.split_once(']').ok_or_else(bad)?;
                (h, tail.strip_prefix(':'))
            }
            None => match authority.split_once(':') {
                Some((h, p)) => (h, Some(p)),
                None => (authority, None),
            },
        };
        let port = match port {
            Some(p) => p.parse().map_err(|_| bad())?,
            None => default_port,
        };
        if host.is_empty() {
            return Err(bad());
        }
        self.host = host.into();
        self.port = port;
        self.path = path.into();
        self.https = https;
        Ok(())
    }
}

/// `<config_dir>/torrentx/config.toml`
pub fn default_config_path() -> PathBuf {
    directories::BaseDirs::new()
        .map(|b| b.config_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
        .join("torrentx")
        .join("config.toml")
}

/// `<data_dir>/torrentx`
pub fn default_data_dir() -> PathBuf {
    directories::BaseDirs::new()
        .map(|b| b.data_dir().to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
        .join("torrentx")
}

impl Config {
    pub fn validate(&self) -> Result<(), String> {
        if self.server.port == 0 {
            return Err("server.port must be between 1 and 65535".into());
        }
        if let Some(h) = self
            .server
            .allowed_hosts
            .iter()
            .find(|h| h.is_empty() || h.contains(|c: char| c.is_whitespace() || c == '/'))
        {
            return Err(format!("invalid allowed host {h:?}"));
        }
        if self.auth.enabled
            && (self.auth.username.is_empty() || self.auth.password_hash.is_empty())
        {
            return Err("auth requires a username and password".into());
        }
        match self.engine.kind {
            EngineKind::Rqbit => {
                if !self.engine.rqbit.download_dir.is_absolute() {
                    return Err("rqbit download directory must be an absolute path".into());
                }
            }
            EngineKind::Transmission => {
                let t = &self.engine.transmission;
                if t.host.trim().is_empty() || t.host.contains(['/', ' ']) {
                    return Err("Transmission host must not be empty".into());
                }
                if t.port == 0 {
                    return Err("Transmission port must be between 1 and 65535".into());
                }
            }
        }
        let proxy = &self.network.proxy;
        if proxy.kind != torrentx_core::ProxyKind::None
            && (proxy.host.trim().is_empty() || proxy.port == 0)
        {
            return Err("proxy requires a host and port".into());
        }
        if self.downloads.move_completed_enabled
            && !Path::new(&self.downloads.move_completed_path).is_absolute()
        {
            return Err("move-completed directory must be an absolute path".into());
        }
        if !self.downloads.default_save_path.is_empty()
            && !Path::new(&self.downloads.default_save_path).is_absolute()
        {
            return Err("default save path must be an absolute path".into());
        }
        if !self.downloads.min_ratio.is_finite() || self.downloads.min_ratio < 0.0 {
            return Err("minimum ratio must be 0 or more".into());
        }
        Ok(())
    }

    pub fn tuning(&self) -> EngineTuning {
        EngineTuning {
            network: self.network.clone(),
            downloads: self.downloads.clone(),
            advanced: self.advanced.clone(),
        }
    }

    /// Loads `path`, creating it with defaults if missing. Never overwrites an
    /// existing file.
    pub fn load_or_create(path: &Path) -> Result<Self, String> {
        let text = match std::fs::read_to_string(path) {
            Ok(t) => t,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
                let config = Self::default();
                config.save(path)?;
                return Ok(config);
            }
            Err(e) => return Err(format!("cannot read config {}: {e}", path.display())),
        };
        let mut config: Self =
            toml::from_str(&text).map_err(|e| format!("invalid config {}: {e}", path.display()))?;
        if let Some(url) = config.engine.transmission.url.take() {
            config
                .engine
                .transmission
                .migrate_url(&url)
                .map_err(|e| format!("invalid config {}: {e}", path.display()))?;
            let bak = path.with_extension("v1.bak");
            std::fs::write(&bak, &text)
                .map_err(|e| format!("cannot write {}: {e}", bak.display()))?;
            config.save(path)?;
        }
        config
            .validate()
            .map_err(|e| format!("invalid config {}: {e}", path.display()))?;
        Ok(config)
    }

    /// Atomic write (temp file + rename), mode 0600 on Unix.
    pub fn save(&self, path: &Path) -> Result<(), String> {
        let err = |e: std::io::Error| format!("cannot write config {}: {e}", path.display());
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(err)?;
        }
        let text = toml::to_string_pretty(self).map_err(|e| e.to_string())?;
        let tmp = path.with_extension("toml.tmp");
        {
            let mut opts = std::fs::OpenOptions::new();
            opts.write(true).create(true).truncate(true);
            #[cfg(unix)]
            std::os::unix::fs::OpenOptionsExt::mode(&mut opts, 0o600);
            let mut f = opts.open(&tmp).map_err(err)?;
            std::io::Write::write_all(&mut f, text.as_bytes()).map_err(err)?;
            f.sync_all().map_err(err)?;
        }
        std::fs::rename(&tmp, path).map_err(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("torrentx-cfg-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        d.join("config.toml")
    }

    #[test]
    fn missing_file_writes_defaults() {
        let p = tmp("missing");
        let c = Config::load_or_create(&p).unwrap();
        assert_eq!(c, Config::default());
        assert_eq!(c.server.port, DEFAULT_PORT);
        assert!(c.server.bind.is_loopback());
        assert!(!c.auth.enabled);
        assert_eq!(Config::load_or_create(&p).unwrap(), c);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&p).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
    }

    #[test]
    fn v1_transmission_url_is_migrated() {
        let p = tmp("v1");
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        let v1 = "[engine]\nkind = \"transmission\"\n\n[engine.transmission]\n\
                  url = \"http://nas:9091/transmission/rpc\"\nusername = \"u\"\npassword = \"p\"\n";
        std::fs::write(&p, v1).unwrap();
        let c = Config::load_or_create(&p).unwrap();
        let t = &c.engine.transmission;
        assert_eq!((t.host.as_str(), t.port, t.path.as_str(), t.https), ("nas", 9091, "/transmission/rpc", false));
        assert_eq!(t.rpc_url(), "http://nas:9091/transmission/rpc");
        assert_eq!(t.password, "p");
        assert_eq!(std::fs::read_to_string(p.with_extension("v1.bak")).unwrap(), v1);
        assert!(!std::fs::read_to_string(&p).unwrap().contains("url ="));
        assert_eq!(Config::load_or_create(&p).unwrap(), c);

        let mut t = TransmissionConfig::default();
        t.migrate_url("https://[::1]/rpc").unwrap();
        assert_eq!((t.host.as_str(), t.port, t.path.as_str()), ("::1", 443, "/rpc"));
        assert_eq!(t.rpc_url(), "https://[::1]:443/rpc");
        assert!(t.migrate_url("ftp://x").is_err());
    }

    #[test]
    fn invalid_file_is_error_and_untouched() {
        let p = tmp("invalid");
        std::fs::create_dir_all(p.parent().unwrap()).unwrap();
        std::fs::write(&p, "this is = = not toml").unwrap();
        let e = Config::load_or_create(&p).unwrap_err();
        assert!(e.contains(&p.display().to_string()), "{e}");
        assert_eq!(std::fs::read_to_string(&p).unwrap(), "this is = = not toml");

        std::fs::write(&p, "[server]\nport = 0\n").unwrap();
        let e = Config::load_or_create(&p).unwrap_err();
        assert!(e.contains("port"), "{e}");
    }
}
