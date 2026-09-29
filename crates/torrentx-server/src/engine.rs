//! The active torrent engine: a closed set, so an enum rather than a trait object.

use std::path::Path;

use torrentx_core::{AddSource, EngineResult, Torrent, TorrentDetails};
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
    pub async fn start(cfg: &EngineConfig, data_dir: &Path) -> EngineResult<Self> {
        Ok(match cfg.kind {
            EngineKind::Rqbit => Self::Rqbit(
                RqbitEngine::start(&cfg.rqbit.download_dir, &data_dir.join("rqbit")).await?,
            ),
            EngineKind::Transmission => {
                let t = &cfg.transmission;
                Self::Transmission(TransmissionEngine::new(&t.url, &t.username, &t.password))
            }
        })
    }

    pub async fn list(&self) -> EngineResult<Vec<Torrent>> {
        dispatch!(self, e => e.list().await)
    }

    pub async fn get(&self, id: &str) -> EngineResult<TorrentDetails> {
        dispatch!(self, e => e.get(id).await)
    }

    pub async fn add(&self, source: AddSource) -> EngineResult<String> {
        dispatch!(self, e => e.add(source).await)
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

    pub async fn shutdown(&self) {
        dispatch!(self, e => e.shutdown().await)
    }
}
