//! TorrentX server: runs a torrent engine and serves the HTTP API + web UI.
//! Used by the `torrentx-server` binary and in-process by the desktop app.

mod api;
mod auth;
pub mod config;
mod engine;
mod ui;

use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::{Mutex, RwLock, oneshot};
use tokio::task::JoinHandle;

use config::Config;
use engine::Engine;

/// Err holds why the engine is not running (reported as `engine_unavailable`).
type EngineSlot = Result<Arc<Engine>, String>;

pub struct AppState {
    engine: RwLock<EngineSlot>,
    config: RwLock<Config>,
    config_path: PathBuf,
    data_dir: PathBuf,
    /// The address actually bound (may differ from config until restart).
    addr: SocketAddr,
    sessions: auth::Sessions,
    settings_lock: Mutex<()>,
}

impl AppState {
    async fn start_engine(config: &Config, data_dir: &std::path::Path) -> EngineSlot {
        Engine::start(&config.engine, data_dir)
            .await
            .map(Arc::new)
            .map_err(|e| {
                tracing::error!("engine failed to start: {e}");
                e.to_string()
            })
    }

    /// Stops the current engine, then starts one from `config`. Stopping first
    /// matters for rqbit→rqbit: both would share the persistence folder.
    async fn restart_engine(&self, config: &Config) {
        let mut slot = self.engine.write().await;
        let old = std::mem::replace(&mut *slot, Err("engine is restarting".into()));
        if let Ok(old) = old {
            old.shutdown().await;
        }
        *slot = Self::start_engine(config, &self.data_dir).await;
    }
}

pub struct ServerOptions {
    pub config_path: PathBuf,
    /// Engine state (rqbit resume data). Defaults to `<data_dir>/torrentx`.
    pub data_dir: Option<PathBuf>,
    pub bind_override: Option<IpAddr>,
    pub port_override: Option<u16>,
}

impl ServerOptions {
    pub fn new(config_path: PathBuf) -> Self {
        Self {
            config_path,
            data_dir: None,
            bind_override: None,
            port_override: None,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum StartError {
    #[error("{0}")]
    Config(String),
    #[error("address {0} is already in use")]
    AddrInUse(SocketAddr),
    #[error("cannot listen on {0}: {1}")]
    Bind(SocketAddr, std::io::Error),
}

pub struct ServerHandle {
    addr: SocketAddr,
    state: Arc<AppState>,
    stop: oneshot::Sender<()>,
    serve: JoinHandle<()>,
}

/// Loads config, binds the socket, starts the engine and serves. Returns once
/// the socket is bound, so the server is reachable when this resolves.
pub async fn start(opts: ServerOptions) -> Result<ServerHandle, StartError> {
    let config = Config::load_or_create(&opts.config_path).map_err(StartError::Config)?;
    let addr = SocketAddr::new(
        opts.bind_override.unwrap_or(config.server.bind),
        opts.port_override.unwrap_or(config.server.port),
    );
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| match e.kind() {
            std::io::ErrorKind::AddrInUse => StartError::AddrInUse(addr),
            _ => StartError::Bind(addr, e),
        })?;
    let addr = listener
        .local_addr()
        .map_err(|e| StartError::Bind(addr, e))?;
    if !addr.ip().is_loopback() && !config.auth.enabled {
        tracing::warn!(
            "listening on {addr} WITHOUT authentication: anyone who can reach this address \
             controls your torrents. Enable auth in settings."
        );
    }

    let data_dir = opts.data_dir.unwrap_or_else(config::default_data_dir);
    let engine = AppState::start_engine(&config, &data_dir).await;
    let state = Arc::new(AppState {
        engine: RwLock::new(engine),
        config: RwLock::new(config),
        config_path: opts.config_path,
        data_dir,
        addr,
        sessions: auth::Sessions::default(),
        settings_lock: Mutex::new(()),
    });

    let (stop, stopped) = oneshot::channel();
    let app = api::router(state.clone());
    let serve = tokio::spawn(async move {
        let shutdown = async {
            let _ = stopped.await;
        };
        if let Err(e) = axum::serve(listener, app)
            .with_graceful_shutdown(shutdown)
            .await
        {
            tracing::error!("http server error: {e}");
        }
    });
    tracing::info!("TorrentX listening on http://{addr}/");
    Ok(ServerHandle {
        addr,
        state,
        stop,
        serve,
    })
}

impl ServerHandle {
    pub fn addr(&self) -> SocketAddr {
        self.addr
    }

    /// Single-use token for `/api/v1/auth/handoff` (desktop auto-login).
    /// Only reachable through this Rust API, never over HTTP.
    pub fn issue_handoff_token(&self) -> String {
        self.state.sessions.create_handoff()
    }

    /// Stops HTTP, then lets the engine persist its state. Bounded to 10 s.
    pub async fn shutdown(self) {
        let _ = self.stop.send(());
        let state = self.state;
        let work = async move {
            let _ = self.serve.await;
            if let Ok(engine) = &*state.engine.read().await {
                engine.shutdown().await;
            }
        };
        if tokio::time::timeout(Duration::from_secs(10), work)
            .await
            .is_err()
        {
            tracing::warn!("shutdown timed out after 10s");
        }
    }
}

#[cfg(test)]
mod tests;
