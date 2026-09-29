//! The active torrent engine: a closed set, so an enum rather than a trait object.

use std::path::Path;

use torrentx_core::{
    AddOptions, AddSource, Capabilities, EngineResult, EngineTuning, Peer, Pieces, Preview,
    Priority, Torrent, TorrentDetails,
};
use torrentx_rqbit::RqbitEngine;
use torrentx_transmission::TransmissionEngine;

use crate::config::{EngineConfig, EngineKind};

pub enum Engine {
    Rqbit(RqbitEngine),
    Transmission(TransmissionEngine),
}

macro_rules! dispatch {
    ($self:ident, $e:ident => $call:expr) => {
        match $self {
            Engine::Rqbit($e) => $call,
            Engine::Transmission($e) => $call,
        }
    };
}

impl Engine {
    /// Transmission is only contacted per call, so it never fails here; its
    /// connectivity errors surface as `engine_unavailable` on each request.
    pub async fn start(
        cfg: &EngineConfig,
        tuning: &EngineTuning,
        data_dir: &Path,
    ) -> EngineResult<Self> {
        Ok(match cfg.kind {
            EngineKind::Rqbit => Self::Rqbit(
                RqbitEngine::start(&cfg.rqbit.download_dir, &data_dir.join("rqbit"), tuning)
                    .await?,
            ),
            EngineKind::Transmission => {
                let t = &cfg.transmission;
                let e = TransmissionEngine::new(&t.rpc_url(), &t.username, &t.password);
                // Daemon keeps its own settings; push ours once, best effort.
                if let Err(err) = e.apply_settings(tuning).await {
                    tracing::warn!("cannot push settings to Transmission: {err}");
                }
                Self::Transmission(e)
            }
        })
    }

    pub async fn capabilities(&self) -> Capabilities {
        dispatch!(self, e => e.capabilities().await)
    }

    pub async fn list(&self) -> EngineResult<Vec<Torrent>> {
        dispatch!(self, e => e.list().await)
    }

    pub async fn get(&self, id: &str) -> EngineResult<TorrentDetails> {
        dispatch!(self, e => e.get(id).await)
    }

    pub async fn add(&self, source: AddSource, opts: &AddOptions) -> EngineResult<String> {
        dispatch!(self, e => e.add(source, opts).await)
    }

    pub async fn preview(&self, source: AddSource) -> EngineResult<Preview> {
        dispatch!(self, e => e.preview(source).await)
    }

    pub async fn pause(&self, id: &str) -> EngineResult<()> {
        dispatch!(self, e => e.pause(id).await)
    }

    pub async fn resume(&self, id: &str) -> EngineResult<()> {
        dispatch!(self, e => e.resume(id).await)
    }

    pub async fn remove(&self, id: &str, delete_data: bool) -> EngineResult<()> {
        dispatch!(self, e => e.remove(id, delete_data).await)
    }

    pub async fn peers(&self, id: &str) -> EngineResult<Vec<Peer>> {
        dispatch!(self, e => e.peers(id).await)
    }

    pub async fn pieces(&self, id: &str) -> EngineResult<Pieces> {
        dispatch!(self, e => e.pieces(id).await)
    }

    pub async fn verify(&self, id: &str) -> EngineResult<()> {
        dispatch!(self, e => e.verify(id).await)
    }

    pub async fn relocate(&self, id: &str, path: &str) -> EngineResult<()> {
        dispatch!(self, e => e.relocate(id, path).await)
    }

    pub async fn rename(&self, id: &str, name: &str) -> EngineResult<()> {
        dispatch!(self, e => e.rename(id, name).await)
    }

    pub async fn add_tracker(&self, id: &str, url: &str) -> EngineResult<()> {
        dispatch!(self, e => e.add_tracker(id, url).await)
    }

    pub async fn set_files(
        &self,
        id: &str,
        indices: &[u32],
        wanted: Option<bool>,
        priority: Option<Priority>,
    ) -> EngineResult<()> {
        dispatch!(self, e => e.set_files(id, indices, wanted, priority).await)
    }

    pub async fn torrent_file(&self, id: &str) -> EngineResult<Vec<u8>> {
        dispatch!(self, e => e.torrent_file(id).await)
    }

    /// Ok(true) = restart the engine for the settings to take effect.
    pub async fn apply_settings(&self, tuning: &EngineTuning) -> EngineResult<bool> {
        dispatch!(self, e => e.apply_settings(tuning).await)
    }

    pub async fn session_totals(&self) -> EngineResult<(u64, u64)> {
        dispatch!(self, e => e.session_totals().await)
    }

    pub async fn shutdown(&self) {
        dispatch!(self, e => e.shutdown().await)
    }
}
