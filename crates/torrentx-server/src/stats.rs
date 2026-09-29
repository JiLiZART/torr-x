//! `/api/v1/stats`: transfer totals plus disk, CPU and memory of the server machine.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use serde_json::{Value, json};
use sysinfo::{Disks, Pid, ProcessRefreshKind, ProcessesToUpdate, System};
use torrentx_core::Status;

use crate::AppState;
use crate::config::EngineKind;

/// Keeps the previous process sample so CPU is averaged since the last call.
pub struct Sampler {
    system: Mutex<System>,
    pid: Option<Pid>,
}

impl Default for Sampler {
    fn default() -> Self {
        Self {
            system: Mutex::new(System::new()),
            pid: sysinfo::get_current_pid().ok(),
        }
    }
}

impl Sampler {
    /// (cpu %, memory bytes) of this process.
    fn process(&self) -> (f32, u64) {
        let Some(pid) = self.pid else { return (0.0, 0) };
        let mut sys = self.system.lock().unwrap();
        sys.refresh_processes_specifics(
            ProcessesToUpdate::Some(&[pid]),
            true,
            ProcessRefreshKind::nothing().with_cpu().with_memory(),
        );
        sys.process(pid)
            .map_or((0.0, 0), |p| (p.cpu_usage(), p.memory()))
    }
}

/// (free, total) of the filesystem holding `path` (longest mount-point prefix).
fn disk_space(path: &Path) -> Option<(u64, u64)> {
    let path = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let disks = Disks::new_with_refreshed_list();
    disks
        .list()
        .iter()
        .filter(|d| path.starts_with(d.mount_point()))
        .max_by_key(|d| d.mount_point().as_os_str().len())
        .map(|d| (d.available_space(), d.total_space()))
}

/// Nearest existing ancestor, so a not-yet-created download dir still maps to a disk.
fn existing_ancestor(mut p: PathBuf) -> PathBuf {
    while !p.exists() && p.pop() {}
    p
}

pub async fn collect(state: &AppState) -> Value {
    let (save_path, kind) = {
        let c = state.config.read().await;
        let p = if c.downloads.default_save_path.is_empty() {
            c.engine.rqbit.download_dir.clone()
        } else {
            PathBuf::from(&c.downloads.default_save_path)
        };
        (p, c.engine.kind)
    };

    let (mut down, mut up, mut downloaded, mut uploaded, mut torrents, mut active) =
        (0, 0, 0, 0, 0, 0);
    if let Ok(engine) = crate::api::engine(state).await {
        if let Ok(all) = engine.list().await {
            torrents = all.len();
            for t in &all {
                down += t.download_rate;
                up += t.upload_rate;
                let moving = t.download_rate > 0 || t.upload_rate > 0;
                if moving && matches!(t.status, Status::Downloading | Status::Seeding) {
                    active += 1;
                }
            }
        }
        if let Ok((d, u)) = engine.session_totals().await {
            (downloaded, uploaded) = (d, u);
        }
    }

    // Transmission's download dir lives on the daemon's host; only report
    // disk space for a path this machine can see.
    let disk = match kind {
        EngineKind::Transmission if !save_path.exists() => None,
        _ => {
            let p = existing_ancestor(save_path);
            tokio::task::spawn_blocking(move || disk_space(&p))
                .await
                .ok()
                .flatten()
        }
    };
    let (cpu, memory) = state.sampler.process();
    json!({
        "downloadRate": down,
        "uploadRate": up,
        "downloaded": downloaded,
        "uploaded": uploaded,
        "ratio": (downloaded > 0).then(|| uploaded as f64 / downloaded as f64),
        "torrents": torrents,
        "active": active,
        "diskFree": disk.map(|d| d.0),
        "diskTotal": disk.map(|d| d.1),
        "cpuPercent": cpu,
        "memoryBytes": memory,
    })
}
