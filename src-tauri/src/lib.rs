// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod backend;
// use backend::{
//     rqbit::RQBitTorrent, transmission::TransmissionRPC, Backend, TorrentBackend, TorrentInfo,
// };
// use std::sync::Arc;
// use tokio::sync::Mutex;

// struct State {
//     transmission: Arc<Mutex<TransmissionRPC>>,
//     rqbit: Arc<Mutex<RQBitTorrent>>,
//     active_backend: Arc<Mutex<Backend>>,
// }

// impl State {
//     async fn get_active_backend(&self) -> Arc<Mutex<dyn TorrentBackend>> {
//         let backend = self.active_backend.lock().await;
//         match *backend {
//             Backend::Transmission => self.transmission.clone(),
//             Backend::Internal => self.rqbit.clone(),
//         }
//     }
// }

// #[tauri::command]
// async fn add_torrent(
//     state: tauri::State<'_, State>,
//     magnet_or_url: String,
// ) -> Result<String, String> {
//     let backend = state.get_active_backend().await;
//     let backend = backend.lock().await;
//     // backend
//     //     .add_torrent(&magnet_or_url)
//     //     .await
//     //     .map_err(|e| e.to_string())
// }

// #[tauri::command]
// async fn get_torrents(state: tauri::State<'_, State>) -> Result<Vec<TorrentInfo>, String> {
//     let backend = state.get_active_backend().await;
//     let backend = backend.lock().await;
//     // backend.get_torrents().await.map_err(|e| e.to_string())
// }

// #[tauri::command]
// async fn set_backend(state: tauri::State<'_, State>, backend: Backend) -> Result<(), String> {
//     *state.active_backend.lock().await = backend;
//     Ok(())
// }

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // let transmission = Arc::new(Mutex::new(backend::transmission::TransmissionRPC::new(
    //     "http://localhost:9091/transmission/rpc".to_string(),
    // )));

    // let rqbit = Arc::new(Mutex::new(backend::rqbit::RQBitTorrent::new(
    //     "./downloads".to_string(),
    // )));

    // let state = State {
    //     transmission,
    //     rqbit,
    //     active_backend: Arc::new(Mutex::new(Backend::Internal)), // Default to internal backend
    // };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // .manage(state)
        // .invoke_handler(tauri::generate_handler![
        //     add_torrent,
        //     get_torrents,
        //     set_backend
        // ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
