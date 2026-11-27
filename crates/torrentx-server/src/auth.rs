//! Optional auth (session cookie or HTTP Basic) and browser-attack guards
//! (Host allowlist, Origin check) that apply even when auth is off.

use std::collections::HashMap;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use argon2::Argon2;
use argon2::password_hash::rand_core::{OsRng, RngCore};
use argon2::password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use axum::Json;
use axum::extract::{ConnectInfo, Query, Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::Next;
use axum::response::{IntoResponse, Redirect, Response};
use base64::Engine as _;
use serde::Deserialize;

use crate::AppState;
use crate::api::ApiError;

pub const COOKIE: &str = "tx_session";
/// "Remember this browser": 30 days of inactivity, persistent cookie.
const REMEMBER_TTL: Duration = Duration::from_secs(30 * 24 * 3600);
/// A plain login: 12 hours of inactivity, cookie ends with the browser session.
const SESSION_TTL: Duration = Duration::from_secs(12 * 3600);
/// Failed logins from one address before it is locked out, and for how long.
pub const MAX_ATTEMPTS: u32 = 5;
const LOCKOUT: Duration = Duration::from_secs(60);
const HANDOFF_TTL: Duration = Duration::from_secs(60);
const STREAM_TTL: Duration = Duration::from_secs(6 * 3600);

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
    /// Token → (expiry, idle lifetime): the lifetime is the session kind.
    sessions: Mutex<HashMap<String, (Instant, Duration)>>,
    /// Client address → (consecutive failures, locked until).
    attempts: Mutex<HashMap<IpAddr, (u32, Option<Instant>)>>,
    handoffs: Mutex<HashMap<String, Instant>>,
    /// Stream URL tokens: torrent id, file index, expiry (sliding).
    streams: Mutex<HashMap<String, (String, u32, Instant)>>,
}

impl Sessions {
    /// A remembered session (30 d); desktop handoffs and settings changes use this kind.
    pub fn create(&self) -> String {
        self.create_kind(true)
    }

    pub fn create_kind(&self, remember: bool) -> String {
        let token = random_token();
        let ttl = if remember { REMEMBER_TTL } else { SESSION_TTL };
        self.sessions
            .lock()
            .unwrap()
            .insert(token.clone(), (Instant::now() + ttl, ttl));
        token
    }

    /// Valid sessions get their expiry extended (sliding window).
    pub fn check(&self, token: &str) -> bool {
        let mut map = self.sessions.lock().unwrap();
        let now = Instant::now();
        map.retain(|_, s| s.0 > now);
        match map.get_mut(token) {
            Some(s) => {
                s.0 = now + s.1;
                true
            }
            None => false,
        }
    }

    /// Seconds left while `ip` is locked out.
    pub fn locked(&self, ip: IpAddr) -> Option<u64> {
        let map = self.attempts.lock().unwrap();
        let until = map.get(&ip)?.1?;
        let left = until.saturating_duration_since(Instant::now());
        (!left.is_zero()).then(|| left.as_secs().max(1))
    }

    /// Counts a failure; returns attempts left (0 = now locked out).
    pub fn fail(&self, ip: IpAddr) -> u32 {
        let mut map = self.attempts.lock().unwrap();
        let now = Instant::now();
        let e = map.entry(ip).or_insert((0, None));
        if e.1.is_some_and(|until| until <= now) {
            *e = (0, None);
        }
        e.0 += 1;
        if e.0 >= MAX_ATTEMPTS {
            e.1 = Some(now + LOCKOUT);
            return 0;
        }
        MAX_ATTEMPTS - e.0
    }

    pub fn succeed(&self, ip: IpAddr) {
        self.attempts.lock().unwrap().remove(&ip);
    }

    pub fn remove(&self, token: &str) {
        self.sessions.lock().unwrap().remove(token);
    }

    pub fn clear(&self) {
        self.sessions.lock().unwrap().clear();
        self.streams.lock().unwrap().clear();
    }

    /// A token that lets one URL read one file without a login: external players have no cookie.
    pub fn create_stream(&self, id: &str, index: u32) -> String {
        let token = random_token();
        let mut map = self.streams.lock().unwrap();
        let now = Instant::now();
        map.retain(|_, s| s.2 > now);
        map.insert(token.clone(), (id.to_string(), index, now + STREAM_TTL));
        token
    }

    /// The file a stream token reads; using it extends its life (players re-request ranges).
    pub fn check_stream(&self, token: &str) -> Option<(String, u32)> {
        let mut map = self.streams.lock().unwrap();
        let now = Instant::now();
        map.retain(|_, s| s.2 > now);
        let s = map.get_mut(token)?;
        s.2 = now + STREAM_TTL;
        Some((s.0.clone(), s.1))
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
    cookie_for(token, true)
}

/// Remembered: persists 30 days. Plain: no Max-Age, so it ends with the browser session.
fn cookie_for(token: &str, remember: bool) -> HeaderValue {
    let age = if remember { format!("; Max-Age={}", REMEMBER_TTL.as_secs()) } else { String::new() };
    HeaderValue::from_str(&format!("{COOKIE}={token}; HttpOnly; SameSite=Strict; Path=/{age}")).expect("token is hex")
}

/// The client address; tests without `ConnectInfo` count as one unknown address.
fn client_ip(ext: &axum::http::Extensions) -> IpAddr {
    ext.get::<ConnectInfo<SocketAddr>>()
        .map_or(IpAddr::V4(Ipv4Addr::UNSPECIFIED), |ConnectInfo(a)| a.ip())
}

fn locked_out(secs: u64) -> Response {
    let body = serde_json::json!({ "error": { "kind": "locked_out", "message": format!("too many attempts: try again in {secs} s"), "retryAfterSecs": secs } });
    (
        StatusCode::TOO_MANY_REQUESTS,
        [(header::RETRY_AFTER, HeaderValue::from(secs))],
        Json(body),
    )
        .into_response()
}

fn wrong(left: u32) -> Response {
    if left == 0 {
        return locked_out(LOCKOUT.as_secs());
    }
    let body = serde_json::json!({ "error": { "kind": "unauthorized", "message": "wrong password", "attemptsLeft": left } });
    (StatusCode::UNAUTHORIZED, Json(body)).into_response()
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

/// Argon2 is deliberately slow; keep it off the async workers. `None` = the sign-in screen, which asks only
/// for the password (one user per server).
async fn credentials_ok(state: &AppState, username: Option<String>, password: String) -> bool {
    let (want_user, hash) = {
        let cfg = state.config.read().await;
        (cfg.auth.username.clone(), cfg.auth.password_hash.clone())
    };
    tokio::task::spawn_blocking(move || {
        // Always verify so wrong usernames take as long as wrong passwords.
        let pass_ok = verify_password(&hash, &password);
        pass_ok && username.is_none_or(|u| u == want_user)
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
    if let Some((user, pass)) = basic_credentials(req.headers()) {
        let ip = client_ip(req.extensions());
        if let Some(secs) = state.sessions.locked(ip) {
            return locked_out(secs);
        }
        if credentials_ok(&state, Some(user), pass).await {
            state.sessions.succeed(ip);
            return next.run(req).await;
        }
        return wrong(state.sessions.fail(ip));
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
    #[serde(default)]
    username: Option<String>,
    password: String,
    #[serde(default)]
    remember: bool,
}

pub async fn login(State(state): State<Arc<AppState>>, ext: axum::http::Extensions, Json(body): Json<Login>) -> Response {
    if !state.config.read().await.auth.enabled {
        return StatusCode::NO_CONTENT.into_response();
    }
    let ip = client_ip(&ext);
    // Locked out: the credentials are not even checked.
    if let Some(secs) = state.sessions.locked(ip) {
        return locked_out(secs);
    }
    if !credentials_ok(&state, body.username, body.password).await {
        return wrong(state.sessions.fail(ip));
    }
    state.sessions.succeed(ip);
    let token = state.sessions.create_kind(body.remember);
    (
        StatusCode::NO_CONTENT,
        [(header::SET_COOKIE, cookie_for(&token, body.remember))],
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
    fn five_failures_lock_one_address() {
        let s = Sessions::default();
        let (a, b): (IpAddr, IpAddr) = ("10.0.0.1".parse().unwrap(), "10.0.0.2".parse().unwrap());
        assert_eq!((1..=5).map(|_| s.fail(a)).collect::<Vec<_>>(), [4, 3, 2, 1, 0]);
        assert!(s.locked(a).is_some_and(|secs| secs <= 60));
        assert_eq!(s.locked(b), None);
        s.succeed(a);
        assert_eq!(s.locked(a), None);
        assert_eq!(s.fail(a), 4);
    }

    #[test]
    fn session_kinds() {
        let s = Sessions::default();
        let plain = s.create_kind(false);
        assert!(s.check(&plain));
        assert_eq!(s.sessions.lock().unwrap()[&plain].1, SESSION_TTL);
        assert!(!cookie_for(&plain, false).to_str().unwrap().contains("Max-Age"));
        assert!(cookie_for(&plain, true).to_str().unwrap().contains("Max-Age=2592000"));
    }

    #[test]
    fn handoff_is_single_use() {
        let s = Sessions::default();
        let t = s.create_handoff();
        assert!(s.redeem_handoff(&t));
        assert!(!s.redeem_handoff(&t));
    }
}
