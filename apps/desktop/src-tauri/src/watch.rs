//! Reacts to server state: native notifications and the autostart login item.
//! In-process: server events. Attached: polls the config file and `/torrents`.

use std::collections::HashMap;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt as _;
use tauri_plugin_notification::NotificationExt as _;
use tokio::sync::broadcast;
use torrentx_server::config::{Config, Preferences};
use torrentx_server::{ServerEvent, ServerInfo};

#[cfg(target_os = "macos")]
const SOUND: &str = "Glass";
#[cfg(not(target_os = "macos"))]
const SOUND: &str = "default";

/// Adds or removes the OS login item to match the preference.
pub fn apply_autostart(app: &AppHandle, prefs: &Preferences) {
    let auto = app.autolaunch();
    let enabled = auto.is_enabled().unwrap_or(false);
    let r = match (prefs.start_with_system, enabled) {
        (true, false) => auto.enable(),
        (false, true) => auto.disable(),
        _ => Ok(()),
    };
    if let Err(e) = r {
        tracing::warn!("cannot update login item: {e}");
    }
}

fn notify(app: &AppHandle, prefs: &Preferences, event: &ServerEvent) {
    let n = &prefs.notifications;
    let (title, name, sound) = match event {
        ServerEvent::TorrentCompleted { name, .. } if n.enabled && n.on_complete => {
            ("Download finished", name, n.sound)
        }
        ServerEvent::TorrentAdded { name, .. } if n.enabled && n.on_add => ("Torrent added", name, false),
        _ => return,
    };
    let mut b = app.notification().builder().title(title).body(name);
    if sound {
        b = b.sound(SOUND);
    }
    if let Err(e) = b.show() {
        tracing::warn!("cannot show notification: {e}");
    }
}

/// In-process server: follow its event channel.
pub fn follow_server(app: AppHandle, info: ServerInfo) {
    let mut rx = info.subscribe();
    tauri::async_runtime::spawn(async move {
        loop {
            let event = match rx.recv().await {
                Ok(e) => e,
                Err(broadcast::error::RecvError::Lagged(_)) => continue,
                Err(broadcast::error::RecvError::Closed) => break,
            };
            let prefs = info.preferences().await;
            match event {
                ServerEvent::SettingsChanged => apply_autostart(&app, &prefs),
                e => notify(&app, &prefs, &e),
            }
        }
    });
}

/// Attached to an external server: poll the shared config file and the torrent list.
/// With auth enabled the list needs a login we don't have, so only autostart works.
pub fn follow_remote(app: AppHandle, config_path: PathBuf, base: String) {
    tauri::async_runtime::spawn(async move {
        let client = reqwest::Client::new();
        let mut mtime: Option<SystemTime> = None;
        let mut prefs = Preferences::default();
        let mut prev: Option<HashMap<String, (String, f64)>> = None;
        loop {
            let m = std::fs::metadata(&config_path).and_then(|m| m.modified()).ok();
            if m != mtime {
                mtime = m;
                if let Ok(c) = Config::load_or_create(&config_path) {
                    prefs = c.preferences;
                    apply_autostart(&app, &prefs);
                }
            }
            let list = client
                .get(format!("{base}api/v1/torrents"))
                .send()
                .await
                .ok()
                .filter(|r| r.status().is_success());
            let list: Option<Vec<serde_json::Value>> = match list {
                Some(r) => r.json().await.ok(),
                None => None,
            };
            if let Some(list) = list {
                let now: HashMap<String, (String, f64)> = list
                    .iter()
                    .filter_map(|t| {
                        let id = t["id"].as_str()?.to_string();
                        let name = t["name"].as_str().unwrap_or_default().to_string();
                        Some((id, (name, t["progress"].as_f64().unwrap_or(0.0))))
                    })
                    .collect();
                if let Some(prev) = &prev {
                    for (id, (name, progress)) in &now {
                        let (id, name) = (id.clone(), name.clone());
                        let event = match prev.get(&id) {
                            None => ServerEvent::TorrentAdded { id, name },
                            Some((_, p)) if *p < 1.0 && *progress >= 1.0 => {
                                ServerEvent::TorrentCompleted { id, name }
                            }
                            _ => continue,
                        };
                        notify(&app, &prefs, &event);
                    }
                }
                prev = Some(now);
            }
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    });
}
