//! `/api/v1` JSON API.

use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;
use std::sync::Arc;

use axum::extract::{
    ConnectInfo, DefaultBodyLimit, FromRequest, Multipart, Path, Query, Request, State,
};
use axum::http::{StatusCode, header};
use axum::middleware::from_fn_with_state;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post, put};
use axum::{Json, Router};
use base64::Engine as _;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use torrentx_core::{
    AddOptions, AddSource, AdvancedSettings, Capabilities, DownloadSettings, EngineError,
    FileHit, FileInfo, NetworkSettings, Peer, Preview, Priority, Status, Torrent, TorrentDetails, Via, parse_id,
};

use crate::config::{Config, EngineKind, Preferences};
use crate::engine::Engine;
use crate::store::{PausedBy, Tab, TabPatch};
use crate::{AppState, ServerEvent, auth, ui};

/// Big enough for any sane .torrent file.
const BODY_LIMIT: usize = 10 * 1024 * 1024;

pub struct ApiError {
    status: StatusCode,
    kind: &'static str,
    message: String,
}

impl ApiError {
    fn new(status: StatusCode, kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            kind,
            message: message.into(),
        }
    }
    pub fn invalid(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_input", msg)
    }
    pub fn not_found(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", msg)
    }
    pub fn unauthorized() -> Self {
        Self::unauthorized_msg("authentication required")
    }
    pub fn unauthorized_msg(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::UNAUTHORIZED, "unauthorized", msg)
    }
    pub fn forbidden(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::FORBIDDEN, "forbidden", msg)
    }
    fn internal(msg: impl Into<String>) -> Self {
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "internal", msg)
    }
}

impl From<EngineError> for ApiError {
    fn from(e: EngineError) -> Self {
        let status = match e {
            EngineError::NotFound(_) => StatusCode::NOT_FOUND,
            EngineError::InvalidInput(_) => StatusCode::BAD_REQUEST,
            EngineError::Duplicate(_) => StatusCode::CONFLICT,
            EngineError::Unavailable(_) => StatusCode::SERVICE_UNAVAILABLE,
            EngineError::Unsupported(_) => StatusCode::NOT_IMPLEMENTED,
        };
        Self::new(status, e.kind(), e.to_string())
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = json!({ "error": { "kind": self.kind, "message": self.message } });
        (self.status, Json(body)).into_response()
    }
}

type ApiResult<T> = Result<T, ApiError>;

pub fn router(state: Arc<AppState>) -> Router {
    let protected = Router::new()
        .route("/torrents", get(list).post(add))
        .route("/torrents/preview", post(preview))
        .route("/files", get(files))
        .route("/torrents/{id}", get(details).delete(remove))
        .route("/torrents/{id}/pause", post(pause))
        .route("/torrents/{id}/resume", post(resume))
        .route("/torrents/{id}/peers", get(peers))
        .route("/torrents/{id}/pieces", get(pieces))
        .route("/torrents/{id}/verify", post(verify))
        .route("/torrents/{id}/relocate", post(relocate))
        .route("/torrents/{id}/rename", post(rename))
        .route("/torrents/{id}/trackers", post(add_tracker))
        .route("/torrents/{id}/files", put(set_files))
        .route("/torrents/{id}/magnet", get(magnet))
        .route("/torrents/{id}/torrent-file", get(torrent_file))
        .route("/torrents/{id}/reveal", post(reveal))
        .route("/torrents/{id}/reannounce", post(reannounce))
        .route("/torrents/{id}/web-seeds", post(add_web_seed))
        .route("/torrents/{id}/files/{index}/open", post(open_file))
        .route("/torrents/{id}/files/{index}/reveal", post(reveal_file))
        .route("/torrents/{id}/files/{index}/stream", post(stream_link))
        .route("/torrents/{id}/files/{index}/play", post(play_file))
        .route("/torrents/{id}/tab", put(set_tab_gone))
        .route("/torrents/{id}/tags", put(set_tags))
        .route("/torrents/{id}/category", put(set_category))
        .route("/tabs", get(tabs).post(create_tab))
        .route("/tabs/{id}", axum::routing::patch(update_tab).delete(delete_tab))
        .route("/stats", get(stats))
        .route("/capabilities", get(capabilities))
        .route("/settings", get(get_settings).put(put_settings))
        .route("/transmission/test", post(test_transmission))
        .route("/network/port-test", post(port_test))
        .route_layer(from_fn_with_state(state.clone(), auth::require_auth));
    let api = Router::new()
        .route("/health", get(health))
        .route("/auth/login", post(auth::login))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/handoff", get(auth::handoff))
        // The token in the path is the credential: external players have no session cookie.
        .route("/stream/{token}/{name}", get(stream_file))
        .merge(protected)
        .fallback(|| async { ApiError::not_found("no such endpoint") });
    Router::new()
        .nest("/api/v1", api)
        .fallback(ui::serve)
        .layer(DefaultBodyLimit::max(BODY_LIMIT))
        .layer(from_fn_with_state(state.clone(), auth::guard))
        .with_state(state)
}

pub(crate) async fn engine(state: &AppState) -> ApiResult<Arc<Engine>> {
    state
        .engine
        .read()
        .await
        .clone()
        .map_err(|msg| EngineError::Unavailable(msg).into())
}

fn store_err(e: String) -> ApiError {
    ApiError::internal(e)
}

async fn health(State(state): State<Arc<AppState>>) -> Json<Value> {
    let cfg = state.config.read().await;
    Json(json!({
        "app": "torrentx",
        "version": env!("CARGO_PKG_VERSION"),
        "engine": cfg.engine.kind.as_str(),
        "authRequired": cfg.auth.enabled,
    }))
}

/// Adds what only the server knows: tags, category, rename override, queued-by-policy.
fn decorate(state: &AppState, t: &mut Torrent) {
    t.tags = state.store.tags_of(&t.id);
    t.category = state.store.category_of(&t.id);
    if let Some(name) = state.store.name_of(&t.id) {
        t.name = name;
    }
    if t.status == Status::Paused && state.store.policy(&t.id).paused_by == Some(PausedBy::Queue)
    {
        t.status = Status::Queued;
    }
}

async fn list(State(state): State<Arc<AppState>>) -> ApiResult<Json<Vec<Torrent>>> {
    let mut all = engine(&state).await?.list().await?;
    all.iter_mut().for_each(|t| decorate(&state, t));
    Ok(Json(all))
}

/// Every file of every torrent with metadata, flat, in list order. Queries run in the UI.
async fn files(State(state): State<Arc<AppState>>) -> ApiResult<Json<Vec<FileHit>>> {
    let engine = engine(&state).await?;
    let (torrents, mut files) = tokio::try_join!(engine.list(), engine.files_all())?;
    let mut hits = Vec::new();
    for mut t in torrents {
        let Some(at) = files.iter().position(|(id, _)| *id == t.id) else {
            continue;
        };
        decorate(&state, &mut t);
        let (_, list) = files.swap_remove(at);
        hits.extend(list.into_iter().map(|file| FileHit {
            torrent_id: t.id.clone(),
            torrent_name: t.name.clone(),
            file,
        }));
    }
    Ok(Json(hits))
}

async fn details(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<TorrentDetails>> {
    let mut d = engine(&state).await?.get(&id).await?;
    decorate(&state, &mut d.torrent);
    Ok(Json(d))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddBody {
    uri: String,
    #[serde(flatten)]
    options: AddOptions,
}

/// JSON `{"uri", ...options}` or multipart with `file` and optional `options` (JSON).
async fn parse_add(req: Request) -> ApiResult<(AddSource, AddOptions)> {
    let is_multipart = req
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("multipart/form-data"));
    if !is_multipart {
        let Json(body) = Json::<AddBody>::from_request(req, &())
            .await
            .map_err(|e| ApiError::invalid(e.body_text()))?;
        return Ok((AddSource::Uri(body.uri), body.options));
    }
    let mut form = Multipart::from_request(req, &())
        .await
        .map_err(|e| ApiError::invalid(e.body_text()))?;
    let (mut bytes, mut options) = (None, AddOptions::default());
    while let Some(field) = form
        .next_field()
        .await
        .map_err(|e| ApiError::invalid(e.body_text()))?
    {
        match field.name() {
            Some("file") => {
                bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| ApiError::invalid(e.body_text()))?,
                )
            }
            Some("options") => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| ApiError::invalid(e.body_text()))?;
                options = serde_json::from_str(&text)
                    .map_err(|e| ApiError::invalid(format!("invalid options: {e}")))?;
            }
            _ => {}
        }
    }
    let bytes = bytes.ok_or_else(|| ApiError::invalid("missing form field \"file\""))?;
    Ok((AddSource::Bytes(bytes.to_vec()), options))
}

async fn add(State(state): State<Arc<AppState>>, req: Request) -> ApiResult<impl IntoResponse> {
    let (source, opts) = parse_add(req).await?;
    let engine = engine(&state).await?;
    let caps = engine.capabilities().await;
    let d = state.config.read().await.downloads.clone();
    let resolved = AddOptions {
        save_path: opts
            .save_path
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .or_else(|| (!d.default_save_path.is_empty()).then(|| d.default_save_path.clone())),
        create_subfolder: Some(opts.create_subfolder.unwrap_or(d.create_subfolder)),
        paused: Some(opts.paused.unwrap_or(!d.start_automatically)),
        priority: caps
            .supports("torrentPriority")
            .then(|| opts.priority.unwrap_or(d.default_priority)),
        wanted_files: opts.wanted_files,
    };
    if let Some(p) = &resolved.save_path
        && !std::path::Path::new(p).is_absolute()
    {
        return Err(ApiError::invalid("save path must be an absolute path"));
    }
    let id = engine.add(source, &resolved).await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

async fn preview(State(state): State<Arc<AppState>>, req: Request) -> ApiResult<Json<Preview>> {
    let (source, _) = parse_add(req).await?;
    Ok(Json(engine(&state).await?.preview(source).await?))
}

async fn pause(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    engine(&state).await?.pause(&id).await?;
    // A user pause overrides whatever the policy loop decided.
    let mut rec = state.store.policy(&id);
    rec.paused_by = None;
    state.store.set_policy(&id, rec).map_err(store_err)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn resume(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    engine(&state).await?.resume(&id).await?;
    let mut rec = state.store.policy(&id);
    rec.paused_by = None;
    state.store.set_policy(&id, rec).map_err(store_err)?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoveQuery {
    #[serde(default)]
    delete_data: bool,
}

async fn remove(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<RemoveQuery>,
) -> ApiResult<StatusCode> {
    engine(&state).await?.remove(&id, q.delete_data).await?;
    state.store.forget(&parse_id(&id)?).map_err(store_err)?;
    Ok(StatusCode::NO_CONTENT)
}

async fn peers(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<Vec<Peer>>> {
    let mut peers = engine(&state).await?.peers(&id).await?;
    for p in &mut peers {
        p.country = state.geoip.country(&p.address);
    }
    Ok(Json(peers))
}

async fn pieces(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    let p = engine(&state).await?.pieces(&id).await?;
    let bitfield = base64::engine::general_purpose::STANDARD.encode(&p.bitfield);
    Ok(Json(json!({ "count": p.count, "bitfield": bitfield })))
}

async fn verify(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    engine(&state).await?.verify(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RelocateBody {
    path: String,
    #[serde(default = "yes")]
    move_data: bool,
}

fn yes() -> bool {
    true
}

async fn relocate(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<RelocateBody>,
) -> ApiResult<StatusCode> {
    let path = body.path.trim();
    if !std::path::Path::new(path).is_absolute() {
        return Err(ApiError::invalid("target directory must be an absolute path"));
    }
    if !body.move_data {
        return Err(ApiError::invalid("only relocating with data is supported"));
    }
    engine(&state).await?.relocate(&id, path).await?;
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct NameBody {
    name: String,
}

async fn rename(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<NameBody>,
) -> ApiResult<StatusCode> {
    let name = body.name.trim();
    if name.is_empty() || name.contains(['/', '\\']) {
        return Err(ApiError::invalid("name must be non-empty and contain no path separators"));
    }
    let engine = engine(&state).await?;
    if engine.capabilities().await.via("rename") == Some(Via::Server) {
        let id = parse_id(&id)?;
        engine.get(&id).await?; // 404 for unknown torrents
        state.store.set_name(&id, name).map_err(store_err)?;
    } else {
        engine.rename(&id, name).await?;
    }
    Ok(StatusCode::NO_CONTENT)
}

#[derive(Deserialize)]
struct TrackerBody {
    url: String,
}

async fn add_tracker(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<TrackerBody>,
) -> ApiResult<StatusCode> {
    let url = body.url.trim();
    let lower = url.to_ascii_lowercase();
    if !["udp://", "http://", "https://", "wss://"]
        .iter()
        .any(|s| lower.starts_with(s))
    {
        return Err(ApiError::invalid("tracker URL must be udp://, http(s):// or wss://"));
    }
    engine(&state).await?.add_tracker(&id, url).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn reannounce(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> ApiResult<StatusCode> {
    engine(&state).await?.reannounce(&parse_id(&id)?).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn add_web_seed(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<TrackerBody>,
) -> ApiResult<StatusCode> {
    let url = body.url.trim();
    let lower = url.to_ascii_lowercase();
    if !(lower.starts_with("http://") || lower.starts_with("https://")) {
        return Err(ApiError::invalid("web seed URL must be http(s)://"));
    }
    let id = parse_id(&id)?;
    engine(&state).await?.add_web_seed(&id, url).await?;
    Ok(StatusCode::NO_CONTENT)
}

/// The file's path on the server machine; 404 for an index the torrent does not have.
/// Only for loopback peers, like `reveal`: a remote browser must not pop windows on the host.
fn is_loopback(req: &Request) -> bool {
    req.extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .is_some_and(|ConnectInfo(a)| a.ip().is_loopback())
}

async fn file_path(state: &AppState, id: &str, index: u32, local: bool) -> ApiResult<(PathBuf, FileInfo)> {
    if !local {
        return Err(ApiError::forbidden("opening files is only available on the machine running TorrentX"));
    }
    let d = engine(state).await?.get(&parse_id(id)?).await?;
    let file = d
        .files
        .iter()
        .find(|f| f.index == index)
        .ok_or_else(|| ApiError::not_found(format!("torrent has no file {index}")))?;
    if !stays_inside(&file.path) {
        return Err(ApiError::invalid("file path leaves the download folder"));
    }
    Ok((PathBuf::from(&d.torrent.save_path).join(&file.path), file.clone()))
}

/// Paths come from torrent metadata: only plain names may follow the save path. An absolute
/// path or a drive prefix would replace it in `join`, and `..` would climb out of it.
fn stays_inside(relative: &str) -> bool {
    !relative.is_empty()
        && std::path::Path::new(relative)
            .components()
            .all(|c| matches!(c, std::path::Component::Normal(_)))
}

async fn open_file(
    State(state): State<Arc<AppState>>,
    Path((id, index)): Path<(String, u32)>,
    req: Request,
) -> ApiResult<StatusCode> {
    let (path, _) = file_path(&state, &id, index, is_loopback(&req)).await?;
    if !path.exists() {
        return Err(ApiError::not_found(format!("{} is not on disk yet", path.display())));
    }
    open::that_detached(&path).map_err(|e| ApiError::internal(format!("cannot open {}: {e}", path.display())))?;
    Ok(StatusCode::NO_CONTENT)
}

/// Opens the folder holding the file (the closest one that exists).
async fn reveal_file(
    State(state): State<Arc<AppState>>,
    Path((id, index)): Path<(String, u32)>,
    req: Request,
) -> ApiResult<StatusCode> {
    let (path, _) = file_path(&state, &id, index, is_loopback(&req)).await?;
    let dir = path.ancestors().skip(1).find(|p| p.is_dir()).map(PathBuf::from).unwrap_or(path);
    open::that_detached(&dir).map_err(|e| ApiError::internal(format!("cannot open {}: {e}", dir.display())))?;
    Ok(StatusCode::NO_CONTENT)
}

/// Readies one file for streaming (torrent running, file wanted) and issues its URL path:
/// `/api/v1/stream/<token>/<file name>`; the name lets players show it and pick a demuxer.
async fn issue_stream(state: &AppState, id: &str, file: &FileInfo) -> ApiResult<String> {
    let engine = engine(state).await?;
    if !engine.can_stream() {
        return Err(EngineError::unsupported("transmission", "streaming").into());
    }
    if !file.wanted {
        engine.set_files(id, &[file.index], Some(true), None).await?;
    }
    if engine.get(id).await?.torrent.status == Status::Paused {
        engine.resume(id).await?;
        let mut rec = state.store.policy(id);
        rec.paused_by = None;
        state.store.set_policy(id, rec).map_err(store_err)?;
    }
    let token = state.sessions.create_stream(id, file.index);
    let name = file.path.rsplit('/').next().unwrap_or(&file.path);
    Ok(format!("/api/v1/stream/{token}/{}", percent_encoding::utf8_percent_encode(name, URI_COMPONENT)))
}

/// A stream URL path for any client, e.g. to paste into a player on another device.
async fn stream_link(
    State(state): State<Arc<AppState>>,
    Path((id, index)): Path<(String, u32)>,
) -> ApiResult<Json<Value>> {
    let id = parse_id(&id)?;
    let d = engine(&state).await?.get(&id).await?;
    let file = d
        .files
        .iter()
        .find(|f| f.index == index)
        .ok_or_else(|| ApiError::not_found(format!("torrent has no file {index}")))?;
    Ok(Json(json!({ "path": issue_stream(&state, &id, file).await? })))
}

/// Plays a file on the server machine: a finished file opens from disk (in the chosen player, else
/// the system default app); an unfinished one opens its stream URL in a video player.
async fn play_file(
    State(state): State<Arc<AppState>>,
    Path((id, index)): Path<(String, u32)>,
    req: Request,
) -> ApiResult<Json<Value>> {
    let id = parse_id(&id)?;
    let (path, file) = file_path(&state, &id, index, is_loopback(&req)).await?;
    let preferred = state.config.read().await.preferences.player.trim().to_string();
    if file.progress >= 1.0 && path.exists() {
        let opened = if preferred.is_empty() { open::that_detached(&path) } else { open::with_detached(&path, &preferred) };
        opened.map_err(|e| ApiError::internal(format!("cannot open {}: {e}", path.display())))?;
        return Ok(Json(json!({ "streaming": false })));
    }
    let player = find_player(&preferred).ok_or_else(|| {
        ApiError::new(
            StatusCode::CONFLICT,
            "no_player",
            "no video player found: install IINA, VLC or mpv, or name one in Settings → General",
        )
    })?;
    let ip = match state.addr.ip() {
        IpAddr::V4(ip) if ip.is_unspecified() => IpAddr::from([127, 0, 0, 1]),
        IpAddr::V6(ip) if ip.is_unspecified() => IpAddr::from(std::net::Ipv6Addr::LOCALHOST),
        ip => ip,
    };
    let url = format!("http://{}{}", SocketAddr::new(ip, state.addr.port()), issue_stream(&state, &id, &file).await?);
    open::with_detached(&url, &player).map_err(|e| ApiError::internal(format!("cannot start {player}: {e}")))?;
    Ok(Json(json!({ "streaming": true })))
}

/// The preferred player, else the first well-known one installed (they all accept http URLs).
fn find_player(preferred: &str) -> Option<String> {
    if !preferred.is_empty() {
        return Some(preferred.to_string());
    }
    let exists = |p: &str| std::path::Path::new(p).exists();
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        ["IINA", "VLC", "mpv"]
            .into_iter()
            .find(|app| exists(&format!("/Applications/{app}.app")) || exists(&format!("{home}/Applications/{app}.app")))
            .map(String::from)
    }
    #[cfg(windows)]
    {
        [
            r"C:\Program Files\VideoLAN\VLC\vlc.exe",
            r"C:\Program Files (x86)\VideoLAN\VLC\vlc.exe",
            r"C:\Program Files\MPC-HC\mpc-hc64.exe",
        ]
        .into_iter()
        .find(|p| exists(p))
        .map(String::from)
    }
    #[cfg(not(any(target_os = "macos", windows)))]
    {
        let _ = exists;
        let path = std::env::var_os("PATH")?;
        ["mpv", "vlc", "celluloid", "totem"]
            .into_iter()
            .find(|bin| std::env::split_paths(&path).any(|dir| dir.join(bin).is_file()))
            .map(String::from)
    }
}

/// `bytes=a-b`, `bytes=a-` or `bytes=-n` as a half-open `[start, end)`; None = not satisfiable.
/// Only the first range of a list is served.
fn byte_range(header: &str, len: u64) -> Option<(u64, u64)> {
    let spec = header.strip_prefix("bytes=")?.split(',').next()?.trim();
    let (a, b) = spec.split_once('-')?;
    let (start, end) = if a.is_empty() {
        (len.saturating_sub(b.parse::<u64>().ok()?), len)
    } else {
        let start = a.parse::<u64>().ok()?;
        let end = if b.is_empty() { len } else { b.parse::<u64>().ok()?.saturating_add(1).min(len) };
        (start, end)
    };
    (start < end).then_some((start, end))
}

fn video_mime(name: &str) -> &'static str {
    match name.rsplit('.').next().unwrap_or_default().to_ascii_lowercase().as_str() {
        "mkv" => "video/x-matroska",
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "avi" => "video/x-msvideo",
        "mov" => "video/quicktime",
        "ts" | "m2ts" => "video/mp2t",
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        _ => "application/octet-stream",
    }
}

/// Serves a file by stream token with HTTP ranges; reads past the downloaded part wait for pieces.
async fn stream_file(
    State(state): State<Arc<AppState>>,
    Path((token, name)): Path<(String, String)>,
    headers: axum::http::HeaderMap,
) -> ApiResult<Response> {
    use tokio::io::{AsyncReadExt, AsyncSeekExt};
    let (id, index) = state
        .sessions
        .check_stream(&token)
        .ok_or_else(|| ApiError::not_found("this stream link has expired"))?;
    let (len, mut reader) = engine(&state).await?.stream(&id, index).await?;
    let range = headers.get(header::RANGE).and_then(|v| v.to_str().ok());
    let (start, end) = match range {
        None => (0, len),
        Some(r) => match byte_range(r, len) {
            Some(r) => r,
            None => {
                return Ok((StatusCode::RANGE_NOT_SATISFIABLE, [(header::CONTENT_RANGE, format!("bytes */{len}"))]).into_response());
            }
        },
    };
    reader
        .seek(std::io::SeekFrom::Start(start))
        .await
        .map_err(|e| ApiError::internal(format!("cannot seek: {e}")))?;
    let body = axum::body::Body::from_stream(tokio_util::io::ReaderStream::new(reader.take(end - start)));
    let mut res = Response::new(body);
    let h = res.headers_mut();
    h.insert(header::CONTENT_TYPE, header::HeaderValue::from_static(video_mime(&name)));
    h.insert(header::ACCEPT_RANGES, header::HeaderValue::from_static("bytes"));
    h.insert(header::CONTENT_LENGTH, (end - start).into());
    if range.is_some() {
        let value = format!("bytes {start}-{}/{len}", end - 1);
        h.insert(header::CONTENT_RANGE, header::HeaderValue::from_str(&value).map_err(|e| ApiError::internal(e.to_string()))?);
        *res.status_mut() = StatusCode::PARTIAL_CONTENT;
    }
    Ok(res)
}

#[derive(Deserialize)]
struct FilesBody {
    indices: Vec<u32>,
    wanted: Option<bool>,
    priority: Option<Priority>,
}

async fn set_files(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<FilesBody>,
) -> ApiResult<StatusCode> {
    if body.indices.is_empty() || (body.wanted.is_none() && body.priority.is_none()) {
        return Err(ApiError::invalid("indices and wanted or priority are required"));
    }
    engine(&state)
        .await?
        .set_files(&id, &body.indices, body.wanted, body.priority)
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

const URI_COMPONENT: &percent_encoding::AsciiSet = &percent_encoding::NON_ALPHANUMERIC
    .remove(b'-')
    .remove(b'.')
    .remove(b'_')
    .remove(b'~');

fn magnet_uri(d: &TorrentDetails) -> String {
    let enc = |s: &str| percent_encoding::utf8_percent_encode(s, URI_COMPONENT).to_string();
    let mut uri = format!("magnet:?xt=urn:btih:{}&dn={}", d.torrent.id, enc(&d.torrent.name));
    for t in &d.trackers {
        uri.push_str("&tr=");
        uri.push_str(&enc(&t.url));
    }
    uri
}

async fn magnet(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> ApiResult<Json<Value>> {
    let mut d = engine(&state).await?.get(&id).await?;
    decorate(&state, &mut d.torrent);
    Ok(Json(json!({ "uri": magnet_uri(&d) })))
}

async fn torrent_file(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Response> {
    let engine = engine(&state).await?;
    let bytes = engine.torrent_file(&id).await?;
    let mut t = engine.get(&id).await?.torrent;
    decorate(&state, &mut t);
    let name = t.name;
    let safe: String = name
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || " ._-()[]".contains(c) { c } else { '_' })
        .collect();
    let disposition = format!("attachment; filename=\"{safe}.torrent\"");
    Ok((
        [
            (header::CONTENT_TYPE, "application/x-bittorrent".to_string()),
            (header::CONTENT_DISPOSITION, disposition),
        ],
        bytes,
    )
        .into_response())
}

/// Opens the torrent's location in the file manager of the server machine.
/// Only for loopback peers: a remote browser must not pop windows on the host.
async fn reveal(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    req: Request,
) -> ApiResult<StatusCode> {
    let local = req
        .extensions()
        .get::<ConnectInfo<SocketAddr>>()
        .is_some_and(|ConnectInfo(a)| a.ip().is_loopback());
    if !local {
        return Err(ApiError::forbidden(
            "show in file manager is only available on the machine running TorrentX",
        ));
    }
    let d = engine(&state).await?.get(&id).await?;
    let dir = PathBuf::from(&d.torrent.save_path);
    let own = dir.join(&d.torrent.name);
    let target = if own.exists() { own } else { dir };
    open::that_detached(&target)
        .map_err(|e| ApiError::internal(format!("cannot open {}: {e}", target.display())))?;
    Ok(StatusCode::NO_CONTENT)
}

// ---- tabs -------------------------------------------------------------------

/// Tabs are saved queries. The query text round-trips verbatim: the server never parses it.
async fn tabs(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(json!({
        "grammarVersion": state.store.grammar_version(),
        "tabs": state.store.tabs(),
    }))
}

#[derive(Deserialize)]
#[serde(default)]
#[derive(Default)]
struct NewTab {
    name: String,
    query: String,
    pinned: bool,
    group: Option<String>,
}

async fn create_tab(
    State(state): State<Arc<AppState>>,
    Json(body): Json<NewTab>,
) -> ApiResult<impl IntoResponse> {
    let tab = state
        .store
        .create_tab(&body.name, &body.query, body.pinned, body.group)
        .map_err(store_err)?;
    Ok((StatusCode::CREATED, Json(tab)))
}

async fn update_tab(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(patch): Json<TabPatch>,
) -> ApiResult<Json<Tab>> {
    match state.store.update_tab(&id, patch).map_err(store_err)? {
        Some(tab) => Ok(Json(tab)),
        None => Err(ApiError::not_found(format!("tab {id} not found"))),
    }
}

async fn delete_tab(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    if state.store.delete_tab(&id).map_err(ApiError::invalid)? {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(ApiError::not_found(format!("tab {id} not found")))
    }
}

async fn set_tags(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(tags): Json<Vec<String>>,
) -> ApiResult<StatusCode> {
    let id = parse_id(&id)?;
    state.store.set_tags(&id, &tags).map_err(ApiError::invalid)?;
    Ok(StatusCode::NO_CONTENT)
}

/// Body: `{"category": "Movies"}`; null or empty clears it.
#[derive(Deserialize)]
struct CategoryBody {
    category: Option<String>,
}

async fn set_category(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<CategoryBody>,
) -> ApiResult<StatusCode> {
    let id = parse_id(&id)?;
    let category = body.category.unwrap_or_default();
    state.store.set_category(&id, &category).map_err(ApiError::invalid)?;
    Ok(StatusCode::NO_CONTENT)
}

/// Manual tab membership was replaced by tags.
async fn set_tab_gone() -> ApiError {
    ApiError::new(
        StatusCode::GONE,
        "not_found",
        "PUT /torrents/{id}/tab was removed; use PUT /torrents/{id}/tags",
    )
}

// ---- stats / capabilities ---------------------------------------------------

async fn stats(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(crate::stats::collect(&state).await)
}

async fn port_test(State(state): State<Arc<AppState>>) -> ApiResult<Json<Value>> {
    let open = engine(&state).await?.port_test().await?;
    Ok(Json(json!({ "open": open })))
}

async fn capabilities(State(state): State<Arc<AppState>>) -> ApiResult<Json<Capabilities>> {
    Ok(Json(engine(&state).await?.capabilities().await))
}

// ---- settings -------------------------------------------------------------

/// Wire shape of settings. Passwords are write-only: never serialized.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    server: ServerSettings,
    auth: AuthSettings,
    engine: EngineSettings,
    #[serde(default)]
    network: NetworkSettings,
    #[serde(default)]
    downloads: DownloadSettings,
    #[serde(default)]
    advanced: AdvancedSettings,
    #[serde(default)]
    preferences: Preferences,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServerSettings {
    bind: String,
    port: u16,
    #[serde(default)]
    allowed_hosts: Vec<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AuthSettings {
    enabled: bool,
    #[serde(default)]
    username: String,
    #[serde(default, skip_serializing)]
    password: Option<String>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EngineSettings {
    kind: EngineKind,
    rqbit: RqbitSettings,
    transmission: TransmissionSettings,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RqbitSettings {
    download_dir: String,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TransmissionSettings {
    host: String,
    port: u16,
    path: String,
    #[serde(default)]
    https: bool,
    #[serde(default)]
    username: String,
    /// Absent = keep the stored password, "" = clear it.
    #[serde(default, skip_serializing)]
    password: Option<String>,
    /// Read-only hint for the UI.
    #[serde(default)]
    has_password: bool,
}

impl From<&Config> for Settings {
    fn from(c: &Config) -> Self {
        let t = &c.engine.transmission;
        let mut network = c.network.clone();
        network.proxy.password.clear();
        Self {
            server: ServerSettings {
                bind: c.server.bind.to_string(),
                port: c.server.port,
                allowed_hosts: c.server.allowed_hosts.clone(),
            },
            auth: AuthSettings {
                enabled: c.auth.enabled,
                username: c.auth.username.clone(),
                password: None,
            },
            engine: EngineSettings {
                kind: c.engine.kind,
                rqbit: RqbitSettings {
                    download_dir: c.engine.rqbit.download_dir.to_string_lossy().into_owned(),
                },
                transmission: TransmissionSettings {
                    host: t.host.clone(),
                    port: t.port,
                    path: t.path.clone(),
                    https: t.https,
                    username: t.username.clone(),
                    password: None,
                    has_password: !t.password.is_empty(),
                },
            },
            network,
            downloads: c.downloads.clone(),
            advanced: c.advanced.clone(),
            preferences: c.preferences.clone(),
        }
    }
}

/// Settings JSON for the wire: proxy password replaced by `hasPassword`.
fn settings_json(c: &Config) -> Value {
    let mut v = serde_json::to_value(Settings::from(c)).expect("settings serialize");
    if let Some(proxy) = v.pointer_mut("/network/proxy").and_then(Value::as_object_mut) {
        proxy.remove("password");
        proxy.insert(
            "hasPassword".into(),
            Value::Bool(!c.network.proxy.password.is_empty()),
        );
    }
    v
}

impl Settings {
    /// Applies the request onto the current config. Returns the new config and
    /// whether auth credentials changed (existing sessions must be dropped).
    /// `proxy_password`: None = keep the stored one.
    fn apply(self, old: &Config, proxy_password: Option<String>) -> ApiResult<(Config, bool)> {
        let mut c = old.clone();
        c.server.bind = self.server.bind.trim().parse::<IpAddr>().map_err(|_| {
            ApiError::invalid(format!("invalid bind address {:?}", self.server.bind))
        })?;
        c.server.port = self.server.port;
        c.server.allowed_hosts = self.server.allowed_hosts;

        let username = self.auth.username.trim().to_string();
        let new_password = self.auth.password.filter(|p| !p.is_empty());
        let mut creds_changed = false;
        if self.auth.enabled {
            let keeps_old = old.auth.enabled && username == old.auth.username;
            match new_password {
                Some(p) => {
                    c.auth.password_hash = auth::hash_password(&p);
                    creds_changed = true;
                }
                None if keeps_old => {}
                None => return Err(ApiError::invalid("enabling auth requires a password")),
            }
            creds_changed |= !old.auth.enabled || username != old.auth.username;
        } else {
            c.auth.password_hash.clear();
        }
        c.auth.enabled = self.auth.enabled;
        c.auth.username = username;

        c.engine.kind = self.engine.kind;
        c.engine.rqbit.download_dir = PathBuf::from(self.engine.rqbit.download_dir.trim());
        let t = self.engine.transmission;
        let ct = &mut c.engine.transmission;
        ct.host = t.host.trim().to_string();
        ct.port = t.port;
        ct.path = t.path.trim().to_string();
        ct.https = t.https;
        ct.username = t.username;
        if let Some(p) = t.password {
            ct.password = p;
        }

        c.network = self.network;
        c.network.proxy.password = proxy_password.unwrap_or_else(|| old.network.proxy.password.clone());
        c.network.proxy.host = c.network.proxy.host.trim().to_string();
        c.downloads = self.downloads;
        c.downloads.default_save_path = c.downloads.default_save_path.trim().to_string();
        c.downloads.move_completed_path = c.downloads.move_completed_path.trim().to_string();
        c.advanced = self.advanced;
        c.preferences = self.preferences;
        c.validate().map_err(ApiError::invalid)?;
        Ok((c, creds_changed))
    }
}

async fn get_settings(State(state): State<Arc<AppState>>) -> Json<Value> {
    Json(settings_json(&*state.config.read().await))
}

/// Takes the body as raw JSON so malformed values (e.g. an unknown language)
/// become `invalid_input` instead of axum's plain-text 422.
async fn put_settings(State(state): State<Arc<AppState>>, body: String) -> ApiResult<Response> {
    let mut v: Value =
        serde_json::from_str(&body).map_err(|e| ApiError::invalid(format!("invalid JSON: {e}")))?;
    let proxy_password = v
        .pointer_mut("/network/proxy")
        .and_then(Value::as_object_mut)
        .and_then(|p| p.remove("password"))
        .and_then(|p| p.as_str().map(String::from));
    let req: Settings =
        serde_json::from_value(v).map_err(|e| ApiError::invalid(format!("invalid settings: {e}")))?;

    // One settings change at a time; config readers are not blocked meanwhile.
    let _guard = state.settings_lock.lock().await;
    let old = state.config.read().await.clone();
    let (new, creds_changed) = req.apply(&old, proxy_password)?;
    new.save(&state.config_path).map_err(ApiError::internal)?;
    *state.config.write().await = new.clone();

    if new.engine != old.engine {
        state.restart_engine(&new).await;
    } else if new.tuning() != old.tuning()
        && let Ok(engine) = engine(&state).await
    {
        match engine.apply_settings(&new.tuning()).await {
            Ok(true) => state.restart_engine(&new).await,
            Ok(false) => {}
            Err(e) => tracing::warn!("cannot apply settings to the engine: {e}"),
        }
    }
    let _ = state.events.send(ServerEvent::SettingsChanged);
    let restart_required = new.server.bind != old.server.bind || new.server.port != old.server.port;
    let body = Json(json!({ "settings": settings_json(&new), "restartRequired": restart_required }));

    if creds_changed {
        // New credentials: drop old sessions, keep the caller logged in.
        state.sessions.clear();
        let token = state.sessions.create();
        return Ok(([(header::SET_COOKIE, auth::session_cookie(&token))], body).into_response());
    }
    Ok(body.into_response())
}

/// Checks a Transmission connection without saving it.
async fn test_transmission(
    State(state): State<Arc<AppState>>,
    Json(t): Json<TransmissionSettings>,
) -> ApiResult<StatusCode> {
    let mut cfg = state.config.read().await.engine.transmission.clone();
    cfg.host = t.host.trim().to_string();
    cfg.port = t.port;
    cfg.path = t.path.trim().to_string();
    cfg.https = t.https;
    cfg.username = t.username;
    if let Some(p) = t.password {
        cfg.password = p;
    }
    if cfg.host.is_empty() || cfg.port == 0 {
        return Err(ApiError::invalid("host and port are required"));
    }
    torrentx_transmission::TransmissionEngine::new(&cfg.rpc_url(), &cfg.username, &cfg.password)
        .ping()
        .await?;
    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod path_tests {
    use super::{byte_range, stays_inside};

    #[test]
    fn byte_ranges_are_half_open_and_clamped() {
        assert_eq!(byte_range("bytes=0-99", 1000), Some((0, 100)));
        assert_eq!(byte_range("bytes=500-", 1000), Some((500, 1000)));
        assert_eq!(byte_range("bytes=-100", 1000), Some((900, 1000)));
        assert_eq!(byte_range("bytes=900-5000", 1000), Some((900, 1000)));
        assert_eq!(byte_range("bytes=0-1, 5-9", 1000), Some((0, 2)));
        assert_eq!(byte_range("bytes=1000-", 1000), None);
        assert_eq!(byte_range("bytes=-0", 1000), None);
        assert_eq!(byte_range("items=0-1", 1000), None);
    }

    #[test]
    fn only_plain_relative_paths_stay_inside() {
        assert!(stays_inside("Show/S01E04.mkv"));
        assert!(stays_inside("file.iso"));
        assert!(!stays_inside("../etc/passwd"));
        assert!(!stays_inside("Show/../../x"));
        assert!(!stays_inside("/etc/passwd"));
        assert!(!stays_inside("./x"));
        assert!(!stays_inside(""));
    }
}
