//! Cover images: which file of a torrent is its cover (WebTorrent Desktop's rules), the cover
//! records, the cache under `<data_dir>/covers/<id>/`, the HTTP handlers and the opt-in TMDB
//! lookup. The server never decodes an image: it only checks the leading bytes.

use std::collections::{BTreeMap, BTreeSet, HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use axum::Json;
use axum::body::Bytes;
use axum::extract::{Path, Query, State};
use axum::http::{StatusCode, header};
use axum::response::{IntoResponse, Response};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use torrentx_core::{EngineError, FileInfo, Torrent, TorrentDetails, parse_id};

use crate::AppState;
use crate::api::{ApiError, ApiResult, engine, stays_inside};
use crate::engine::Engine;

/// Larger image files of a torrent are never used as covers (they are served whole).
const MAX_IMAGE: u64 = 20 * 1024 * 1024;
const MAX_UPLOAD: usize = 512 * 1024;
const MAX_ONLINE: usize = 5 * 1024 * 1024;
/// Key of the torrent's own cover in `removed` / `looked_up`; files use their index.
const TORRENT: &str = "torrent";

// ---- records ----------------------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Source {
    /// An image file of the torrent itself; read from the download, never copied.
    File,
    Online,
    Frame,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cover {
    pub source: Source,
    /// `File`: index of the torrent's image file.
    #[serde(default)]
    pub index: u32,
    /// Other sources: file name in the cache folder.
    #[serde(default)]
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct CoverRec {
    pub torrent: Option<Cover>,
    /// Frames and episode images of video files, by file index.
    pub files: BTreeMap<u32, Cover>,
    /// Covers the user removed: no automatic source sets them again.
    pub removed: BTreeSet<String>,
    /// Lookups already made, found or not: never repeated.
    pub looked_up: BTreeSet<String>,
}

// ---- selection rules (pure) -------------------------------------------------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Kind {
    Image,
    Audio,
    Video,
    Other,
}

/// SVG is left out on purpose: served from the app's origin it could run script.
const IMAGE_EXT: &[&str] = &["jpg", "jpeg", "png", "gif", "webp"];
const AUDIO_EXT: &[&str] = &[
    "mp3", "flac", "wav", "aac", "m4a", "ogg", "opus", "wma", "alac", "ape", "aiff", "dsf",
];
const VIDEO_EXT: &[&str] = &[
    "mkv", "mp4", "m4v", "avi", "mov", "webm", "ts", "m2ts", "wmv", "mpg", "mpeg", "flv", "3gp", "vob", "ogv",
];

fn base(path: &str) -> &str {
    path.rsplit('/').next().unwrap_or(path)
}

fn folder(path: &str) -> &str {
    path.rsplit_once('/').map_or("", |(dir, _)| dir)
}

fn kind(path: &str) -> Kind {
    let ext = base(path).rsplit_once('.').map_or(String::new(), |(_, e)| e.to_ascii_lowercase());
    let ext = ext.as_str();
    if IMAGE_EXT.contains(&ext) {
        Kind::Image
    } else if AUDIO_EXT.contains(&ext) {
        Kind::Audio
    } else if VIDEO_EXT.contains(&ext) {
        Kind::Video
    } else {
        Kind::Other
    }
}

fn candidate(f: &FileInfo) -> bool {
    f.wanted && f.size <= MAX_IMAGE && kind(&f.path) == Kind::Image
}

/// Album-art score of an image by its name, then its size.
fn art_rank(f: &FileInfo) -> (i32, u64) {
    const WORDS: &[(&str, i32)] = &[
        ("cover", 80),
        ("folder", 80),
        ("album", 80),
        ("front", 80),
        ("back", 20),
        ("spectrogram", -80),
    ];
    let name = base(&f.path).to_lowercase();
    let stem = name.rsplit_once('.').map_or(name.as_str(), |(s, _)| s);
    let score = WORDS.iter().find(|(w, _)| stem.contains(w)).map_or(0, |(_, s)| *s);
    (score, f.size)
}

/// Length of the folder every path starts with (engines differ on whether paths include it).
fn root_len(files: &[FileInfo]) -> usize {
    let first = files.first().and_then(|f| f.path.split_once('/')).map(|(dir, _)| dir);
    match first {
        Some(dir) if files.iter().all(|f| f.path.split_once('/').is_some_and(|(d, _)| d == dir)) => dir.len() + 1,
        _ => 0,
    }
}

/// Index of the image file that is the torrent's cover: `poster.*` in the root, else by the kind
/// holding the most wanted bytes (audio: best album-art name; images: the largest; video: none).
pub fn pick_cover(files: &[FileInfo]) -> Option<u32> {
    let root = root_len(files);
    let is_poster = |f: &&FileInfo| {
        let rest = &f.path[root..];
        !rest.contains('/') && rest.rsplit_once('.').is_some_and(|(stem, _)| stem.eq_ignore_ascii_case("poster"))
    };
    if let Some(f) = files.iter().filter(|f| candidate(f)).find(is_poster) {
        return Some(f.index);
    }
    let bytes = |k: Kind| files.iter().filter(|f| f.wanted && kind(&f.path) == k).map(|f| f.size).sum::<u64>();
    let (audio, video, image) = (bytes(Kind::Audio), bytes(Kind::Video), bytes(Kind::Image));
    let images = files.iter().filter(|f| candidate(f));
    if audio > 0 && audio >= video && audio >= image {
        images.max_by_key(|f| art_rank(f)).map(|f| f.index)
    } else if image > 0 && image >= video {
        images.max_by_key(|f| f.size).map(|f| f.index)
    } else {
        None
    }
}

/// The file whose frame stands for the torrent: the largest one a frame is captured from
/// (WebTorrent Desktop's list; the UI's `CAPTURE_EXT` is the same).
fn largest_video(files: &[FileInfo]) -> Option<u32> {
    const CAPTURE_EXT: &[&str] = &["avi", "mp4", "m4v", "webm", "mov", "mkv", "mpg", "mpeg", "ogv", "wmv", "m2ts"];
    let ext = |f: &FileInfo| base(&f.path).rsplit_once('.').map_or(String::new(), |(_, e)| e.to_ascii_lowercase());
    let videos = files.iter().filter(|f| CAPTURE_EXT.contains(&ext(f).as_str()));
    videos.max_by_key(|f| f.size).map(|f| f.index)
}

/// Where a cover's bytes are.
#[derive(Debug, Clone, PartialEq)]
enum Loc {
    /// A file of the torrent, by index.
    File(u32),
    /// A file in the cache folder.
    Cache(String),
}

#[derive(Debug, Clone, PartialEq)]
struct Resolved {
    loc: Loc,
    version: String,
}

fn file_version(f: &FileInfo) -> String {
    format!("f{}-{}", f.index, f.size)
}

fn of_torrent(rec: &CoverRec) -> Option<Resolved> {
    let c = rec.torrent.as_ref()?;
    let loc = if c.source == Source::File { Loc::File(c.index) } else { Loc::Cache(c.name.clone()) };
    Some(Resolved { loc, version: c.version.clone() })
}

/// The cover of each file, in the order of `files`: an image is its own once complete; a video
/// has its frame or episode image; audio has the best image of its folder, else the torrent's.
fn of_files(rec: &CoverRec, files: &[FileInfo]) -> Vec<Option<Resolved>> {
    let torrent = of_torrent(rec);
    let own = |f: &FileInfo| Resolved { loc: Loc::File(f.index), version: file_version(f) };
    let mut art: HashMap<&str, &FileInfo> = HashMap::new();
    for f in files.iter().filter(|f| candidate(f)) {
        let best = art.entry(folder(&f.path)).or_insert(f);
        if art_rank(f) > art_rank(best) {
            *best = f;
        }
    }
    files
        .iter()
        .map(|f| {
            if rec.removed.contains(&f.index.to_string()) {
                return None;
            }
            match kind(&f.path) {
                Kind::Image if f.progress >= 1.0 && f.size <= MAX_IMAGE => Some(own(f)),
                Kind::Video => rec.files.get(&f.index).map(|c| Resolved {
                    loc: Loc::Cache(c.name.clone()),
                    version: c.version.clone(),
                }),
                Kind::Audio => {
                    let local = art.get(folder(&f.path)).filter(|a| a.progress >= 1.0);
                    local.map(|a| own(a)).or_else(|| torrent.clone())
                }
                _ => None,
            }
        })
        .collect()
}

/// Image type by leading bytes: `(content type, extension)`. Anything else, SVG included, is None.
pub fn sniff(bytes: &[u8]) -> Option<(&'static str, &'static str)> {
    if bytes.starts_with(&[0xFF, 0xD8, 0xFF]) {
        Some(("image/jpeg", "jpg"))
    } else if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        Some(("image/png", "png"))
    } else if bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a") {
        Some(("image/gif", "gif"))
    } else if bytes.len() >= 12 && &bytes[..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        Some(("image/webp", "webp"))
    } else {
        None
    }
}

// ---- server side ------------------------------------------------------------

/// Fills `cover` on a torrent from its record.
pub fn decorate(state: &AppState, t: &mut Torrent) {
    t.cover = state.store.covers(&t.id).torrent.map(|c| c.version);
}

pub fn decorate_files(state: &AppState, id: &str, files: &mut [FileInfo]) {
    let found = of_files(&state.store.covers(id), files);
    for (f, cover) in files.iter_mut().zip(found) {
        f.cover = cover.map(|c| c.version);
    }
}

fn cache_dir(state: &AppState, id: &str) -> PathBuf {
    state.data_dir.join("covers").join(id)
}

/// Deletes the cached covers of a removed torrent.
pub fn forget(state: &AppState, id: &str) {
    let _ = std::fs::remove_dir_all(cache_dir(state, id));
}

/// Stores image bytes in the cache; the version is a hash of the bytes.
async fn cache(state: &AppState, id: &str, name: &str, bytes: &[u8]) -> ApiResult<String> {
    let dir = cache_dir(state, id);
    let err = |e: std::io::Error| ApiError::internal(format!("cannot write {}: {e}", dir.display()));
    tokio::fs::create_dir_all(&dir).await.map_err(err)?;
    tokio::fs::write(dir.join(name), bytes).await.map_err(err)?;
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    bytes.hash(&mut hasher);
    Ok(format!("{:016x}", hasher.finish()))
}

/// Policy-tick step: a torrent's picked image file becomes its cover once it is complete, with no
/// client connected. The engine is asked for files only while some torrent is still waiting:
/// one with a local cover or a removed one is done (its record says so), and `nothing` (in
/// memory) holds the torrents whose files have no image to pick.
pub async fn tick(state: &AppState, engine: &Engine, list: &[Torrent], nothing: &mut HashSet<String>) {
    nothing.retain(|id| list.iter().any(|t| t.id == *id));
    let waiting = |id: &str, nothing: &HashSet<String>| {
        let rec = state.store.covers(id);
        let local = rec.torrent.as_ref().is_some_and(|c| c.source == Source::File);
        !nothing.contains(id) && !local && !rec.removed.contains(TORRENT)
    };
    if !list.iter().any(|t| waiting(&t.id, nothing)) {
        return;
    }
    let Ok(all) = engine.files_all().await else { return };
    for (id, files) in all {
        if files.is_empty() || !waiting(&id, nothing) {
            continue;
        }
        // shortcut: the pick is not redone when the wanted files change, until the next start.
        match pick_cover(&files).and_then(|i| files.iter().find(|f| f.index == i)) {
            Some(f) if f.progress >= 1.0 => {
                let cover = Cover { source: Source::File, index: f.index, name: String::new(), version: file_version(f) };
                if let Err(e) = state.store.update_covers(&id, |r| r.torrent = Some(cover)) {
                    tracing::warn!("{e}");
                }
            }
            Some(_) => {} // still downloading
            None => drop(nothing.insert(id)),
        }
    }
}

#[derive(Deserialize)]
pub struct VersionQuery {
    v: Option<String>,
}

/// The image with its sniffed type. Sniffing and sandboxing headers keep a hostile file from a
/// torrent from being read as anything but an image.
async fn respond(
    state: &AppState,
    id: &str,
    found: Resolved,
    details: Option<TorrentDetails>,
    v: Option<&str>,
) -> ApiResult<Response> {
    let gone = || ApiError::not_found("no cover");
    let path = match &found.loc {
        Loc::Cache(name) => cache_dir(state, id).join(name),
        Loc::File(index) => {
            let d = match details {
                Some(d) => d,
                None => engine(state).await?.get(id).await?,
            };
            let file = d.files.iter().find(|f| f.index == *index).ok_or_else(gone)?;
            if file.size > MAX_IMAGE || !stays_inside(&file.path) {
                return Err(gone());
            }
            PathBuf::from(&d.torrent.save_path).join(&file.path)
        }
    };
    let bytes = tokio::fs::read(&path).await.map_err(|_| gone())?;
    let (mime, _) = sniff(&bytes).ok_or_else(gone)?;
    let caching = if v == Some(found.version.as_str()) { "private, max-age=31536000, immutable" } else { "no-cache" };
    Ok((
        [
            (header::CONTENT_TYPE, mime),
            (header::X_CONTENT_TYPE_OPTIONS, "nosniff"),
            (header::CONTENT_SECURITY_POLICY, "default-src 'none'; sandbox"),
            (header::CACHE_CONTROL, caching),
        ],
        bytes,
    )
        .into_response())
}

pub async fn get_cover(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Query(q): Query<VersionQuery>,
) -> ApiResult<Response> {
    let id = parse_id(&id)?;
    let found = of_torrent(&state.store.covers(&id)).ok_or_else(|| ApiError::not_found("no cover"))?;
    respond(&state, &id, found, None, q.v.as_deref()).await
}

pub async fn get_file_cover(
    State(state): State<Arc<AppState>>,
    Path((id, index)): Path<(String, u32)>,
    Query(q): Query<VersionQuery>,
) -> ApiResult<Response> {
    let id = parse_id(&id)?;
    let d = engine(&state).await?.get(&id).await?;
    let at = d.files.iter().position(|f| f.index == index);
    let found = at.and_then(|at| of_files(&state.store.covers(&id), &d.files).swap_remove(at));
    let found = found.ok_or_else(|| ApiError::not_found("no cover"))?;
    respond(&state, &id, found, Some(d), q.v.as_deref()).await
}

fn store_err(e: String) -> ApiError {
    ApiError::internal(e)
}

/// A frame captured by a client. It also becomes the torrent's cover when it is the largest
/// video file's and nothing better (an image file, an online poster) is set.
pub async fn put_file_cover(
    State(state): State<Arc<AppState>>,
    Path((id, index)): Path<(String, u32)>,
    body: Bytes,
) -> ApiResult<Json<Value>> {
    let id = parse_id(&id)?;
    if body.len() > MAX_UPLOAD {
        return Err(ApiError::invalid("a cover is at most 512 KB"));
    }
    let (_, ext) = sniff(&body)
        .filter(|(_, ext)| *ext != "gif")
        .ok_or_else(|| ApiError::invalid("a cover must be a JPEG, PNG or WebP image"))?;
    let d = engine(&state).await?.get(&id).await?;
    if !d.files.iter().any(|f| f.index == index && kind(&f.path) == Kind::Video) {
        return Err(ApiError::invalid(format!("file {index} is not a video file")));
    }
    let key = index.to_string();
    let rec = state.store.covers(&id);
    // Removed by the user, or an episode image is already there: the frame is not wanted.
    if rec.removed.contains(&key) || rec.files.get(&index).is_some_and(|c| c.source == Source::Online) {
        return Ok(Json(json!({ "cover": rec.files.get(&index).map(|c| &c.version) })));
    }
    let name = format!("f{index}.{ext}");
    let version = cache(&state, &id, &name, &body).await?;
    let cover = Cover { source: Source::Frame, index: 0, name, version: version.clone() };
    let promote = largest_video(&d.files) == Some(index);
    state
        .store
        .update_covers(&id, |r| {
            let frame_or_none = r.torrent.as_ref().is_none_or(|c| c.source == Source::Frame);
            if promote && frame_or_none && !r.removed.contains(TORRENT) {
                r.torrent = Some(cover.clone());
            }
            r.files.insert(index, cover);
        })
        .map_err(store_err)?;
    Ok(Json(json!({ "cover": version })))
}

pub async fn delete_cover(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> ApiResult<StatusCode> {
    let id = parse_id(&id)?;
    engine(&state).await?.get(&id).await?; // 404 for unknown torrents
    state
        .store
        .update_covers(&id, |r| {
            r.torrent = None;
            r.removed.insert(TORRENT.into());
        })
        .map_err(store_err)?;
    Ok(StatusCode::NO_CONTENT)
}

pub async fn delete_file_cover(
    State(state): State<Arc<AppState>>,
    Path((id, index)): Path<(String, u32)>,
) -> ApiResult<StatusCode> {
    let id = parse_id(&id)?;
    let d = engine(&state).await?.get(&id).await?;
    if !d.files.iter().any(|f| f.index == index) {
        return Err(ApiError::not_found(format!("torrent has no file {index}")));
    }
    state
        .store
        .update_covers(&id, |r| {
            r.files.remove(&index);
            r.removed.insert(index.to_string());
        })
        .map_err(store_err)?;
    Ok(StatusCode::NO_CONTENT)
}

// ---- online lookup (opt-in) -------------------------------------------------

/// TMDB base URLs; tests point them at a local server.
pub struct Tmdb {
    pub api: String,
    pub images: String,
}

impl Default for Tmdb {
    fn default() -> Self {
        Self { api: "https://api.themoviedb.org/3".into(), images: "https://image.tmdb.org/t/p".into() }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
enum LookupKind {
    Movie,
    Tv,
}

/// What a client asks for. Only `title`, `year`, `season` and `episode` ever leave the machine.
#[derive(Debug, Deserialize)]
pub struct Lookup {
    kind: LookupKind,
    title: String,
    year: Option<u16>,
    season: Option<u32>,
    episode: Option<u32>,
    /// With a file index: the episode image, as that file's cover.
    file: Option<u32>,
}

async fn tmdb_get(
    client: &reqwest::Client,
    key: &str,
    url: &str,
    mut params: Vec<(&str, String)>,
) -> Result<reqwest::Response, String> {
    // A v4 read access token is a JWT and goes in a header; a v3 key is a query parameter.
    let bearer = key.contains('.');
    if !bearer {
        params.push(("api_key", key.to_string()));
    }
    let url = reqwest::Url::parse_with_params(url, &params).map_err(|e| e.to_string())?;
    let mut req = client.get(url);
    if bearer {
        req = req.bearer_auth(key);
    }
    // `without_url`: the URL may hold the key.
    let res = req.send().await.map_err(|e| format!("cover lookup failed: {}", e.without_url()))?;
    if res.status().is_success() {
        Ok(res)
    } else {
        Err(format!("cover lookup failed: the service answered {}", res.status()))
    }
}

/// The first match's poster, or its episode still when `q.file` is set. Ok(None) = no match.
async fn tmdb_image(tmdb: &Tmdb, key: &str, q: &Lookup) -> Result<Option<Vec<u8>>, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("torrentx")
        .build()
        .map_err(|e| e.to_string())?;
    let json = |res: reqwest::Response| async move { res.json::<Value>().await.map_err(|e| e.without_url().to_string()) };
    let kind = if q.kind == LookupKind::Tv { "tv" } else { "movie" };
    let mut params = vec![("query", q.title.trim().to_string())];
    if let Some(year) = q.year {
        params.push(("year", year.to_string()));
    }
    let found = json(tmdb_get(&client, key, &format!("{}/search/{kind}", tmdb.api), params).await?).await?;
    let Some(first) = found["results"].get(0) else { return Ok(None) };
    let path = match (q.file, q.season, q.episode, first["id"].as_u64()) {
        (Some(_), Some(season), Some(episode), Some(show)) => {
            let url = format!("{}/tv/{show}/season/{season}/episode/{episode}", tmdb.api);
            match tmdb_get(&client, key, &url, Vec::new()).await {
                Ok(res) => json(res).await?["still_path"].as_str().map(|p| format!("/w300{p}")),
                Err(_) => None, // no such episode
            }
        }
        _ => first["poster_path"].as_str().map(|p| format!("/w780{p}")),
    };
    let Some(path) = path else { return Ok(None) };
    let res = client.get(format!("{}{path}", tmdb.images)).send().await.map_err(|e| e.without_url().to_string())?;
    if !res.status().is_success() {
        return Ok(None);
    }
    let bytes = res.bytes().await.map_err(|e| e.without_url().to_string())?;
    Ok((bytes.len() <= MAX_ONLINE && sniff(&bytes).is_some()).then(|| bytes.to_vec()))
}

pub async fn lookup(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(q): Json<Lookup>,
) -> ApiResult<Json<Value>> {
    let cfg = state.config.read().await.covers.clone();
    if !cfg.online_lookup || cfg.api_key.is_empty() {
        return Err(EngineError::Unsupported("online cover lookup is off".into()).into());
    }
    let id = parse_id(&id)?;
    if q.title.trim().is_empty() {
        return Err(ApiError::invalid("title is required"));
    }
    if q.file.is_some() && (q.kind != LookupKind::Tv || q.season.is_none() || q.episode.is_none()) {
        return Err(ApiError::invalid("a file lookup needs kind \"tv\", season and episode"));
    }
    let key = q.file.map_or(TORRENT.to_string(), |i| i.to_string());
    let current = |r: &CoverRec| match q.file {
        Some(i) => r.files.get(&i).map(|c| c.version.clone()),
        None => r.torrent.as_ref().map(|c| c.version.clone()),
    };
    let local = |r: &CoverRec| q.file.is_none() && r.torrent.as_ref().is_some_and(|c| c.source == Source::File);
    let rec = state.store.covers(&id);
    if rec.looked_up.contains(&key) || rec.removed.contains(&key) || local(&rec) {
        return Ok(Json(json!({ "cover": current(&rec) })));
    }
    let d = engine(&state).await?.get(&id).await?;
    if let Some(i) = q.file
        && !d.files.iter().any(|f| f.index == i && kind(&f.path) == Kind::Video)
    {
        return Err(ApiError::invalid(format!("file {i} is not a video file")));
    }
    let image = tmdb_image(&state.tmdb, &cfg.api_key, &q)
        .await
        .map_err(|e| ApiError::new(StatusCode::BAD_GATEWAY, "lookup_failed", e))?;
    let cover = match &image {
        Some(bytes) => {
            let ext = sniff(bytes).map_or("jpg", |(_, ext)| ext);
            let name = q.file.map_or(format!("torrent.{ext}"), |i| format!("o{i}.{ext}"));
            let version = cache(&state, &id, &name, bytes).await?;
            Some(Cover { source: Source::Online, index: 0, name, version })
        }
        None => None,
    };
    let mut out = None;
    state
        .store
        .update_covers(&id, |r| {
            r.looked_up.insert(key.clone());
            if let Some(cover) = cover
                && !r.removed.contains(&key)
                && !local(r)
            {
                match q.file {
                    Some(i) => drop(r.files.insert(i, cover)),
                    None => r.torrent = Some(cover),
                }
            }
            out = current(r);
        })
        .map_err(store_err)?;
    Ok(Json(json!({ "cover": out })))
}

#[cfg(test)]
mod tests {
    use super::*;
    use torrentx_core::Priority;

    fn f(index: u32, path: &str, size: u64) -> FileInfo {
        FileInfo { index, path: path.into(), size, progress: 1.0, wanted: true, priority: Priority::Normal, cover: None }
    }

    #[test]
    fn poster_in_the_root_wins() {
        let files = [f(0, "Film/Film.mkv", 900), f(1, "Film/extras/poster.jpg", 9), f(2, "Film/Poster.PNG", 5)];
        assert_eq!(pick_cover(&files), Some(2));
        // Paths without the shared folder (rqbit) work the same.
        assert_eq!(pick_cover(&[f(0, "Film.mkv", 900), f(1, "poster.jpg", 5)]), Some(1));
        // Not in the root, and video decides: no image file is used.
        assert_eq!(pick_cover(&files[..2]), None);
    }

    #[test]
    fn album_art_by_name_then_size() {
        let album = [
            f(0, "A/01.flac", 500),
            f(1, "A/back.jpg", 90),
            f(2, "A/folder.jpg", 10),
            f(3, "A/spectrogram.png", 99),
        ];
        assert_eq!(pick_cover(&album), Some(2));
        let tie = [f(0, "A/01.mp3", 500), f(1, "A/cover.jpg", 10), f(2, "A/front.jpg", 20)];
        assert_eq!(pick_cover(&tie), Some(2), "same score: the larger file");
        let only = [f(0, "A/01.mp3", 500), f(1, "A/spectrogram.png", 10)];
        assert_eq!(pick_cover(&only), Some(1), "last choice, still a choice");
        assert_eq!(pick_cover(&[f(0, "A/01.mp3", 500)]), None);
    }

    #[test]
    fn image_and_video_torrents() {
        let scans = [f(0, "S/01.png", 10), f(1, "S/02.png", 30), f(2, "S/readme.txt", 5)];
        assert_eq!(pick_cover(&scans), Some(1));
        let film = [f(0, "F/film.mp4", 900), f(1, "F/screenshot.jpg", 10)];
        assert_eq!(pick_cover(&film), None);
    }

    #[test]
    fn svg_huge_and_unwanted_images_are_never_picked() {
        let mut files = vec![f(0, "A/01.mp3", 500), f(1, "A/cover.svg", 10), f(2, "A/cover.jpg", MAX_IMAGE + 1)];
        assert_eq!(pick_cover(&files), None);
        files.push(f(3, "A/cover.png", 10));
        files[3].wanted = false;
        assert_eq!(pick_cover(&files), None);
        assert_eq!(pick_cover(&[f(0, "poster.svg", 10)]), None);
    }

    #[test]
    fn two_albums_have_their_own_art() {
        let mut files = vec![
            f(0, "T/A/1.flac", 100),
            f(1, "T/A/cover.jpg", 10),
            f(2, "T/B/1.flac", 100),
            f(3, "T/B/cover.jpg", 20),
            f(4, "T/C/1.flac", 100),
            f(5, "T/notes.txt", 1),
        ];
        let mut rec = CoverRec::default();
        let loc = |rec: &CoverRec, files: &[FileInfo], at: usize| of_files(rec, files)[at].clone().map(|r| r.loc);
        assert_eq!(loc(&rec, &files, 0), Some(Loc::File(1)));
        assert_eq!(loc(&rec, &files, 2), Some(Loc::File(3)));
        assert_eq!(loc(&rec, &files, 1), Some(Loc::File(1)), "an image is its own cover");
        assert_eq!(loc(&rec, &files, 5), None);
        // No image in the folder: the torrent's cover, when it has one.
        assert_eq!(loc(&rec, &files, 4), None);
        rec.torrent = Some(Cover { source: Source::File, index: 3, name: String::new(), version: "v".into() });
        assert_eq!(loc(&rec, &files, 4), Some(Loc::File(3)));
        // Not downloaded yet: no cover from it.
        files[1].progress = 0.5;
        assert_eq!(loc(&rec, &files, 1), None);
        assert_eq!(loc(&rec, &files, 0), Some(Loc::File(3)));
        rec.removed.insert("2".into());
        assert_eq!(loc(&rec, &files, 2), None);
    }

    #[test]
    fn image_type_comes_from_the_bytes() {
        assert_eq!(sniff(&[0xFF, 0xD8, 0xFF, 0xE0, 0]), Some(("image/jpeg", "jpg")));
        assert_eq!(sniff(b"\x89PNG\r\n\x1a\n\0\0"), Some(("image/png", "png")));
        assert_eq!(sniff(b"GIF89a.."), Some(("image/gif", "gif")));
        assert_eq!(sniff(b"RIFF\0\0\0\0WEBPVP8 "), Some(("image/webp", "webp")));
        assert_eq!(sniff(b"RIFF\0\0\0\0WAVEfmt "), None);
        assert_eq!(sniff(b"hello, I am text"), None);
        assert_eq!(sniff(b"<svg xmlns=\"http://www.w3.org/2000/svg\"><script>1</script></svg>"), None);
        assert_eq!(sniff(b""), None);
    }
}
