//! `/api/v1` JSON API.

use std::net::IpAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::extract::{DefaultBodyLimit, FromRequest, Multipart, Path, Query, Request, State};
use axum::http::{StatusCode, header};
use axum::middleware::from_fn_with_state;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use torrentx_core::{AddSource, EngineError, Torrent, TorrentDetails};

use crate::config::{Config, EngineKind};
use crate::engine::Engine;
use crate::{AppState, auth, ui};

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
        .route("/torrents/{id}", get(details).delete(remove))
        .route("/torrents/{id}/pause", post(pause))
        .route("/torrents/{id}/resume", post(resume))
        .route("/settings", get(get_settings).put(put_settings))
        .route_layer(from_fn_with_state(state.clone(), auth::require_auth));
    let api = Router::new()
        .route("/health", get(health))
        .route("/auth/login", post(auth::login))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/handoff", get(auth::handoff))
        .merge(protected)
        .fallback(|| async { ApiError::not_found("no such endpoint") });
    Router::new()
        .nest("/api/v1", api)
        .fallback(ui::serve)
        .layer(DefaultBodyLimit::max(BODY_LIMIT))
        .layer(from_fn_with_state(state.clone(), auth::guard))
        .with_state(state)
}

async fn engine(state: &AppState) -> ApiResult<Arc<Engine>> {
    state
        .engine
        .read()
        .await
        .clone()
        .map_err(|msg| EngineError::Unavailable(msg).into())
}

async fn health(State(state): State<Arc<AppState>>) -> Json<serde_json::Value> {
    let cfg = state.config.read().await;
    Json(json!({
        "app": "torrentx",
        "version": env!("CARGO_PKG_VERSION"),
        "engine": cfg.engine.kind.as_str(),
        "authRequired": cfg.auth.enabled,
    }))
}

async fn list(State(state): State<Arc<AppState>>) -> ApiResult<Json<Vec<Torrent>>> {
    Ok(Json(engine(&state).await?.list().await?))
}

async fn details(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<TorrentDetails>> {
    Ok(Json(engine(&state).await?.get(&id).await?))
}

#[derive(Deserialize)]
struct AddUri {
    uri: String,
}

/// JSON `{"uri": ...}` or multipart with a `file` field.
async fn add(State(state): State<Arc<AppState>>, req: Request) -> ApiResult<impl IntoResponse> {
    let is_multipart = req
        .headers()
        .get(header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .is_some_and(|v| v.starts_with("multipart/form-data"));
    let source = if is_multipart {
        let mut form = Multipart::from_request(req, &())
            .await
            .map_err(|e| ApiError::invalid(e.body_text()))?;
        let mut bytes = None;
        while let Some(field) = form
            .next_field()
            .await
            .map_err(|e| ApiError::invalid(e.body_text()))?
        {
            if field.name() == Some("file") {
                bytes = Some(
                    field
                        .bytes()
                        .await
                        .map_err(|e| ApiError::invalid(e.body_text()))?,
                );
                break;
            }
        }
        AddSource::Bytes(
            bytes
                .ok_or_else(|| ApiError::invalid("missing form field \"file\""))?
                .to_vec(),
        )
    } else {
        let Json(body) = Json::<AddUri>::from_request(req, &())
            .await
            .map_err(|e| ApiError::invalid(e.body_text()))?;
        AddSource::Uri(body.uri)
    };
    let id = engine(&state).await?.add(source).await?;
    Ok((StatusCode::CREATED, Json(json!({ "id": id }))))
}

async fn pause(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    engine(&state).await?.pause(&id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn resume(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<StatusCode> {
    engine(&state).await?.resume(&id).await?;
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
    Ok(StatusCode::NO_CONTENT)
}

// ---- settings -------------------------------------------------------------

/// Wire shape of settings. Passwords are write-only: never serialized.
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    server: ServerSettings,
    auth: AuthSettings,
    engine: EngineSettings,
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
struct TransmissionSettings {
    url: String,
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
                    url: c.engine.transmission.url.clone(),
                    username: c.engine.transmission.username.clone(),
                    password: None,
                    has_password: !c.engine.transmission.password.is_empty(),
                },
            },
        }
    }
}

impl Settings {
    /// Applies the request onto the current config. Returns the new config and
    /// whether auth credentials changed (existing sessions must be dropped).
    fn apply(self, old: &Config) -> ApiResult<(Config, bool)> {
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
        c.engine.transmission.url = self.engine.transmission.url.trim().to_string();
        c.engine.transmission.username = self.engine.transmission.username;
        if let Some(p) = self.engine.transmission.password {
            c.engine.transmission.password = p;
        }
        c.validate().map_err(ApiError::invalid)?;
        Ok((c, creds_changed))
    }
}

async fn get_settings(State(state): State<Arc<AppState>>) -> Json<Settings> {
    Json(Settings::from(&*state.config.read().await))
}

async fn put_settings(
    State(state): State<Arc<AppState>>,
    Json(req): Json<Settings>,
) -> ApiResult<Response> {
    // One settings change at a time; config readers are not blocked meanwhile.
    let _guard = state.settings_lock.lock().await;
    let old = state.config.read().await.clone();
    let (new, creds_changed) = req.apply(&old)?;
    new.save(&state.config_path).map_err(ApiError::internal)?;
    *state.config.write().await = new.clone();

    if new.engine != old.engine {
        state.restart_engine(&new).await;
    }
    let restart_required = new.server.bind != old.server.bind || new.server.port != old.server.port;
    let body =
        Json(json!({ "settings": Settings::from(&new), "restartRequired": restart_required }));

    if creds_changed {
        // New credentials: drop old sessions, keep the caller logged in.
        state.sessions.clear();
        let token = state.sessions.create();
        return Ok(([(header::SET_COOKIE, auth::session_cookie(&token))], body).into_response());
    }
    Ok(body.into_response())
}
