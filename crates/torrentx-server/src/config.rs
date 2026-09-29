//! TOML config file: load / validate / atomic save.

use std::net::{IpAddr, Ipv4Addr};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

pub const DEFAULT_PORT: u16 = 9977;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Default)]
#[serde(default, deny_unknown_fields)]
pub struct Config {
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub engine: EngineConfig,
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
    pub url: String,
    pub username: String,
    /// Plaintext: needed to call the RPC. The file is written with mode 0600.
    pub password: String,
}

impl Default for TransmissionConfig {
    fn default() -> Self {
        Self {
            url: "http://127.0.0.1:9091/transmission/rpc".into(),
            username: String::new(),
            password: String::new(),
        }
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
                let url = &self.engine.transmission.url;
                if !(url.starts_with("http://") || url.starts_with("https://")) {
                    return Err("Transmission RPC URL must start with http:// or https://".into());
                }
            }
        }
        Ok(())
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
        let config: Self =
            toml::from_str(&text).map_err(|e| format!("invalid config {}: {e}", path.display()))?;
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
