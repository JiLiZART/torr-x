//! TorrentX desktop shell: runs the TorrentX server in-process (or attaches to
//! one already listening on the configured port), shows its web UI in a window
//! and lives in the tray.

mod watch;

use std::net::{IpAddr, Ipv4Addr};
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager, RunEvent, WebviewUrl, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};
use tauri_plugin_opener::OpenerExt;
use torrentx_server::config::Config;
use torrentx_server::{ServerHandle, ServerOptions, StartError};

const WINDOW: &str = "main";

/// In-process server, if we started one (None in attach mode or after quit).
struct Server(Mutex<Option<ServerHandle>>);

/// Base URL of the server's web UI, e.g. `http://127.0.0.1:9977/`.
struct UiUrl(String);

enum Probe {
    TorrentX,
    Nothing,
    Foreign,
}

async fn probe(base: &str) -> Probe {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(800))
        .build()
        .expect("reqwest client");
    match client.get(format!("{base}api/v1/health")).send().await {
        Ok(resp) => match resp.json::<serde_json::Value>().await {
            Ok(v) if v["app"] == "torrentx" => Probe::TorrentX,
            _ => Probe::Foreign,
        },
        Err(e) if e.is_connect() => Probe::Nothing,
        Err(_) => Probe::Foreign,
    }
}

/// Resolves which URL the window should load, starting the server if needed.
/// Err is a user-facing message. Also starts notification/autostart watching.
async fn connect(app: &AppHandle, config_path: &Path) -> Result<(String, String), String> {
    let config = Config::load_or_create(config_path)?;
    // A wildcard bind is reachable on loopback; a specific IP only on itself.
    let host = match config.server.bind {
        ip if ip.is_unspecified() || ip.is_loopback() => IpAddr::V4(Ipv4Addr::LOCALHOST),
        ip => ip,
    };
    let port = config.server.port;
    let base = match host {
        IpAddr::V6(ip) => format!("http://[{ip}]:{port}/"),
        IpAddr::V4(ip) => format!("http://{ip}:{port}/"),
    };
    let port_taken = || {
        format!(
            "Port {port} is used by another program.\n\n\
             Change `port` in {} or stop that program, then start TorrentX again.",
            config_path.display()
        )
    };

    match probe(&base).await {
        Probe::TorrentX => {
            tracing::info!("attaching to TorrentX server at {base}");
            watch::follow_remote(app.clone(), config_path.to_path_buf(), base.clone());
            Ok((base.clone(), base))
        }
        Probe::Foreign => Err(port_taken()),
        Probe::Nothing => {
            let server = torrentx_server::start(ServerOptions::new(config_path.to_path_buf()))
                .await
                .map_err(|e| match e {
                    StartError::AddrInUse(_) => port_taken(),
                    e => e.to_string(),
                })?;
            // Auth on: log the window in without asking for the password.
            let window_url = if config.auth.enabled {
                format!(
                    "{base}api/v1/auth/handoff?token={}",
                    server.issue_handoff_token()
                )
            } else {
                base.clone()
            };
            let info = server.info();
            *app.state::<Server>().0.lock().unwrap() = Some(server);
            watch::apply_autostart(app, &config.preferences);
            watch::follow_server(app.clone(), info);
            Ok((base, window_url))
        }
    }
}

/// Frameless: the web UI header draws the window controls and drag area.
fn open_window(app: &AppHandle, url: &str, visible: bool) -> tauri::Result<()> {
    #[cfg(debug_assertions)]
    let url = std::env::var("TORRENTX_UI_DEV_URL").unwrap_or_else(|_| url.to_string());
    let url = url.parse().expect("server URL is valid");
    WebviewWindowBuilder::new(app, WINDOW, WebviewUrl::External(url))
        .title("TorrentX")
        .decorations(false)
        .shadow(true)
        .resizable(true)
        .inner_size(1100.0, 720.0)
        .min_inner_size(900.0, 600.0)
        .visible(visible)
        .build()?;
    Ok(())
}

fn show_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(WINDOW) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn toggle_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(WINDOW) {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_window(app);
        }
    }
}

/// Asks first when downloads would stop (preference), then quits.
fn quit(app: &AppHandle) {
    let info = app
        .state::<Server>()
        .0
        .lock()
        .unwrap()
        .as_ref()
        .map(|s| s.info());
    let app = app.clone();
    tauri::async_runtime::spawn(async move {
        let downloading = match &info {
            Some(i) if i.preferences().await.confirm_exit_while_downloading => i.downloading().await,
            _ => 0,
        };
        if downloading == 0 {
            return shutdown_and_exit(app).await;
        }
        let handle = app.clone();
        app.dialog()
            .message(format!(
                "{downloading} torrent(s) are downloading. Quitting TorrentX stops them."
            ))
            .title("Quit TorrentX?")
            .kind(MessageDialogKind::Warning)
            .buttons(MessageDialogButtons::OkCancelCustom("Quit".into(), "Cancel".into()))
            .show(move |ok| {
                if ok {
                    tauri::async_runtime::spawn(shutdown_and_exit(handle));
                }
            });
    });
}

/// Stops the in-process server (engine persists state), then exits.
async fn shutdown_and_exit(app: AppHandle) {
    let server = app.state::<Server>().0.lock().unwrap().take();
    if let Some(server) = server {
        server.shutdown().await;
    }
    app.exit(0);
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show TorrentX", true, None::<&str>)?;
    let browser = MenuItem::with_id(app, "browser", "Open in Browser", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &browser, &sep, &quit_item])?;

    let mut tray = TrayIconBuilder::with_id("main")
        .tooltip("TorrentX")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_window(app),
            "browser" => {
                let url = app.state::<UiUrl>().0.clone();
                let _ = app.opener().open_url(url, None::<&str>);
            }
            "quit" => quit(app),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                toggle_window(tray.app_handle());
            }
        });
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.build(app)?;
    Ok(())
}

fn fail(app: &AppHandle, message: String, config_path: PathBuf) {
    tracing::error!("{message}");
    let handle = app.clone();
    app.dialog()
        .message(message)
        .title("TorrentX cannot start")
        .kind(MessageDialogKind::Error)
        .buttons(MessageDialogButtons::OkCancelCustom(
            "Show config file".into(),
            "Quit".into(),
        ))
        .show(move |show_config| {
            if show_config {
                let _ = handle.opener().reveal_item_in_dir(&config_path);
            }
            handle.exit(1);
        });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,librqbit=warn".into()),
        )
        .init();

    let app = tauri::Builder::default()
        // Must be registered first: a second launch just focuses the running one.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app)
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(Server(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let config_path = torrentx_server::config::default_config_path();
                match connect(&handle, &config_path).await {
                    Ok((base, window_url)) => {
                        handle.manage(UiUrl(base));
                        let visible = !Config::load_or_create(&config_path)
                            .is_ok_and(|c| c.preferences.start_minimized);
                        let ready = build_tray(&handle)
                            .and_then(|_| open_window(&handle, &window_url, visible));
                        if let Err(e) = ready {
                            fail(
                                &handle,
                                format!("Cannot open the TorrentX window: {e}"),
                                config_path,
                            );
                        }
                    }
                    Err(message) => fail(&handle, message, config_path),
                }
            });
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window keeps TorrentX running in the tray.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building TorrentX");

    app.run(|app, event| {
        // Cmd+Q / OS logout: stop the server gracefully before exiting.
        if let RunEvent::ExitRequested { api, .. } = event
            && app.state::<Server>().0.lock().unwrap().is_some()
        {
            api.prevent_exit();
            quit(app);
        }
    });
}
