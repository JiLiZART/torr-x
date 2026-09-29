use std::net::IpAddr;
use std::path::PathBuf;

use clap::Parser;
use torrentx_server::{ServerOptions, config};

/// TorrentX headless torrent server: HTTP API + web UI.
#[derive(Parser)]
#[command(version)]
struct Args {
    /// Config file (created with defaults if missing).
    /// Default: <config_dir>/torrentx/config.toml
    #[arg(long)]
    config: Option<PathBuf>,
    /// Override the bind address for this run (config file unchanged).
    #[arg(long)]
    bind: Option<IpAddr>,
    /// Override the port for this run (config file unchanged).
    #[arg(long)]
    port: Option<u16>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,librqbit=warn".into()),
        )
        .init();

    let args = Args::parse();
    let opts = ServerOptions {
        config_path: args.config.unwrap_or_else(config::default_config_path),
        data_dir: None,
        bind_override: args.bind,
        port_override: args.port,
    };
    let server = match torrentx_server::start(opts).await {
        Ok(s) => s,
        Err(e) => {
            eprintln!("torrentx-server: {e}");
            std::process::exit(1);
        }
    };
    wait_for_signal().await;
    tracing::info!("shutting down");
    server.shutdown().await;
}

async fn wait_for_signal() {
    #[cfg(unix)]
    {
        use tokio::signal::unix::{SignalKind, signal};
        let mut term = signal(SignalKind::terminate()).expect("SIGTERM handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {}
            _ = term.recv() => {}
        }
    }
    #[cfg(not(unix))]
    let _ = tokio::signal::ctrl_c().await;
}
