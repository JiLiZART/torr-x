//! Optional auth (session cookie or HTTP Basic) and browser-attack guards
//! (Host allowlist, Origin check) that apply even when auth is off.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use argon2::Argon2;
use argon2::password_hash::rand_core::{OsRng, RngCore};
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use axum::Json;
use axum::extract::{Query, Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Redirect, Response};
use base64::Engine as _;
use serde::Deserialize;

use crate::AppState;
use crate::api::ApiError;

pub const COOKIE: &str = "tx_session";
const SESSION_TTL: Duration = Duration::from_secs(30 * 24 * 3600);
const HANDOFF_TTL: Duration = Duration::from_secs(60);

pub fn hash_password(password: &str) -> String {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .expect("argon2 hashing with default params cannot fail")
        .to_string()
}

pub fn verify_password(hash: &str, password: &str) -> bool {
    PasswordHash::new(hash)
        .map(|h| {
            Argon2::default()
                .verify_password(password.as_bytes(), &h)
                .is_ok()
        })
        .unwrap_or(false)
}

fn random_token() -> String {
    let mut buf = [0u8; 32];
    OsRng.fill_bytes(&mut buf);
    buf.iter().map(|b| format!("{b:02x}")).collect()
}

/// In-memory: sessions are lost on restart (users log in again).
#[derive(Default)]
pub struct Sessions {
    sessions: Mutex<HashMap<String, Instant>>,
    handoffs: Mutex<HashMap<String, Instant>>,
}

impl Sessions {
    pub fn create(&self) -> String {
        let token = random_token();
        self.sessions
            .lock()
            .unwrap()
            .insert(token.clone(), Instant::now() + SESSION_TTL);
        token
    }

    /// Valid sessions get their expiry extended (sliding window).
    pub fn check(&self, token: &str) -> bool {
        let mut map = self.sessions.lock().unwrap();
        let now = Instant::now();
        map.retain(|_, exp| *exp > now);
        match map.get_mut(token) {
            Some(exp) => {
                *exp = now + SESSION_TTL;
                true
            }
            None => false,
        }
    }

    pub fn remove(&self, token: &str) {
        self.sessions.lock().unwrap().remove(token);
    }

    pub fn clear(&self) {
        self.sessions.lock().unwrap().clear();
    }

    /// Single-use, short-lived token the desktop app exchanges for a session.
    pub fn create_handoff(&self) -> String {
        let token = random_token();
        self.handoffs
            .lock()
            .unwrap()
            .insert(token.clone(), Instant::now() + HANDOFF_TTL);
        token
    }

    fn redeem_handoff(&self, token: &str) -> bool {
        self.handoffs
            .lock()
            .unwrap()
            .remove(token)
            .is_some_and(|exp| exp > Instant::now())
    }
}

pub fn session_cookie(token: &str) -> HeaderValue {
    HeaderValue::from_str(&format!(
        "{COOKIE}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={}",
        SESSION_TTL.as_secs()
    ))
    .expect("token is hex")
}

fn clear_cookie() -> HeaderValue {
    HeaderValue::from_static("tx_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0")
}

fn cookie_token(headers: &HeaderMap) -> Option<&str> {
    headers
        .get_all(header::COOKIE)
        .iter()
        .filter_map(|v| v.to_str().ok())
        .flat_map(|v| v.split(';'))
        .find_map(|kv| kv.trim().strip_prefix("tx_session="))
}

fn basic_credentials(headers: &HeaderMap) -> Option<(String, String)> {
    let value = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    let encoded = value.strip_prefix("Basic ")?;
    let decoded = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .ok()?;
    let (user, pass) = std::str::from_utf8(&decoded).ok()?.split_once(':')?;
    Some((user.to_string(), pass.to_string()))
}

/// Argon2 is deliberately slow; keep it off the async workers.
async fn credentials_ok(state: &AppState, username: String, password: String) -> bool {
    let (want_user, hash) = {
        let cfg = state.config.read().await;
        (cfg.auth.username.clone(), cfg.auth.password_hash.clone())
    };
    tokio::task::spawn_blocking(move || {
        // Always verify so wrong usernames take as long as wrong passwords.
        let pass_ok = verify_password(&hash, &password);
        pass_ok && username == want_user
    })
    .await
    .unwrap_or(false)
}

pub async fn require_auth(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Response {
    if !state.config.read().await.auth.enabled {
        return next.run(req).await;
    }
    if cookie_token(req.headers()).is_some_and(|t| state.sessions.check(t)) {
        return next.run(req).await;
    }
    if let Some((user, pass)) = basic_credentials(req.headers())
        && credentials_ok(&state, user, pass).await
    {
        return next.run(req).await;
    }
    ApiError::unauthorized().into_response()
}

/// Host header without the port (`[::1]:9977` → `[::1]`).
fn host_name(host: &str) -> &str {
    if host.starts_with('[') {
        return host
            .split_once(']')
            .map_or(host, |(h, _)| &host[..h.len() + 1]);
    }
    match host.rsplit_once(':') {
        Some((h, port)) if port.bytes().all(|b| b.is_ascii_digit()) => h,
        _ => host,
    }
}

pub async fn guard(State(state): State<Arc<AppState>>, req: Request, next: Next) -> Response {
    let host = req
        .headers()
        .get(header::HOST)
        .and_then(|h| h.to_str().ok())
        .unwrap_or_default()
        .to_string();

    // Anti DNS-rebinding: a loopback server only answers to loopback names.
    if state.addr.ip().is_loopback() {
        let name = host_name(&host).to_ascii_lowercase();
        let allowed = matches!(name.as_str(), "localhost" | "127.0.0.1" | "[::1]")
            || state
                .config
                .read()
                .await
                .server
                .allowed_hosts
                .iter()
                .any(|h| h.eq_ignore_ascii_case(&name) || h.eq_ignore_ascii_case(&host));
        if !allowed {
            return ApiError::forbidden(format!("host {host:?} is not allowed")).into_response();
        }
    }

    // Anti CSRF: browsers always send Origin on cross-site writes.
    let unsafe_method = !matches!(*req.method(), Method::GET | Method::HEAD | Method::OPTIONS);
    if unsafe_method && let Some(origin) = req.headers().get(header::ORIGIN) {
        let origin = origin.to_str().unwrap_or_default();
        let same = origin == format!("http://{host}") || origin == format!("https://{host}");
        if !same {
            return ApiError::forbidden("cross-origin request rejected").into_response();
        }
    }
    next.run(req).await
}

#[derive(Deserialize)]
pub struct Login {
    username: String,
    password: String,
}

pub async fn login(State(state): State<Arc<AppState>>, Json(body): Json<Login>) -> Response {
    if !state.config.read().await.auth.enabled {
        return StatusCode::NO_CONTENT.into_response();
    }
    if !credentials_ok(&state, body.username, body.password).await {
        return ApiError::unauthorized_msg("wrong username or password").into_response();
    }
    let token = state.sessions.create();
    (
        StatusCode::NO_CONTENT,
        [(header::SET_COOKIE, session_cookie(&token))],
    )
        .into_response()
}

pub async fn logout(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    if let Some(t) = cookie_token(&headers) {
        state.sessions.remove(t);
    }
    (
        StatusCode::NO_CONTENT,
        [(header::SET_COOKIE, clear_cookie())],
    )
        .into_response()
}

#[derive(Deserialize)]
pub struct Handoff {
    token: String,
}

/// Desktop auto-login: exchanges a one-time token for a session cookie.
pub async fn handoff(State(state): State<Arc<AppState>>, Query(q): Query<Handoff>) -> Response {
    if !state.sessions.redeem_handoff(&q.token) {
        return Redirect::to("/").into_response();
    }
    let token = state.sessions.create();
    (
        [(header::SET_COOKIE, session_cookie(&token))],
        Redirect::to("/"),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn host_name_strips_port() {
        assert_eq!(host_name("localhost:9977"), "localhost");
        assert_eq!(host_name("127.0.0.1"), "127.0.0.1");
        assert_eq!(host_name("[::1]:9977"), "[::1]");
        assert_eq!(host_name("evil.example:9977"), "evil.example");
    }

    #[test]
    fn password_hash_round_trip() {
        let h = hash_password("hunter2");
        assert!(h.starts_with("$argon2id$"));
        assert!(verify_password(&h, "hunter2"));
        assert!(!verify_password(&h, "hunter3"));
        assert!(!verify_password("garbage", "hunter2"));
    }

    #[test]
    fn handoff_is_single_use() {
        let s = Sessions::default();
        let t = s.create_handoff();
        assert!(s.redeem_handoff(&t));
        assert!(!s.redeem_handoff(&t));
    }
}
