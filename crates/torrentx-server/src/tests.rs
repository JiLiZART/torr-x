use std::net::{Ipv4Addr, SocketAddr};

use axum::body::Body;
use axum::http::{HeaderMap, Method, Request, StatusCode, header};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use tower::ServiceExt;

use super::*;

const HOST: &str = "127.0.0.1:9977";
const ZERO_ID: &str = "0000000000000000000000000000000000000000";

fn tmpdir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("torrentx-srv-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn state_with(
    dir: &std::path::Path,
    config: Config,
    engine: EngineSlot,
    addr: SocketAddr,
) -> Arc<AppState> {
    let config_path = dir.join("config.toml");
    config.save(&config_path).unwrap();
    Arc::new(AppState::new(config, config_path, dir.join("data"), engine, addr).unwrap())
}

fn test_config(dir: &std::path::Path) -> Config {
    let mut c = Config::default();
    c.engine.rqbit.download_dir = dir.join("dl");
    c.engine.transmission.port = 1;
    c
}

/// State with no running engine: enough for everything but torrent ops.
fn state(name: &str) -> (Arc<AppState>, PathBuf) {
    let dir = tmpdir(name);
    let s = state_with(
        &dir,
        test_config(&dir),
        Err("no engine in test".into()),
        HOST.parse().unwrap(),
    );
    (s, dir)
}

fn req(method: Method, uri: &str) -> axum::http::request::Builder {
    Request::builder()
        .method(method)
        .uri(uri)
        .header(header::HOST, HOST)
}

fn json_req(method: Method, uri: &str, body: &Value) -> Request<Body> {
    req(method, uri)
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(body.to_string()))
        .unwrap()
}

async fn call(state: &Arc<AppState>, r: Request<Body>) -> (StatusCode, HeaderMap, Value) {
    let resp = api::router(state.clone()).oneshot(r).await.unwrap();
    let (parts, body) = resp.into_parts();
    let bytes = body.collect().await.unwrap().to_bytes();
    let v = serde_json::from_slice(&bytes)
        .unwrap_or_else(|_| Value::String(String::from_utf8_lossy(&bytes).into()));
    (parts.status, parts.headers, v)
}

async fn get(state: &Arc<AppState>, uri: &str) -> (StatusCode, HeaderMap, Value) {
    call(state, req(Method::GET, uri).body(Body::empty()).unwrap()).await
}

fn cookie(headers: &HeaderMap) -> Option<String> {
    headers
        .get(header::SET_COOKIE)
        .map(|v| v.to_str().unwrap().split(';').next().unwrap().to_string())
        .filter(|c| c != "tx_session=")
}

#[tokio::test]
async fn health_shape() {
    let (s, _) = state("health");
    let (status, _, body) = get(&s, "/api/v1/health").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["app"], "torrentx");
    assert_eq!(body["engine"], "rqbit");
    assert_eq!(body["authRequired"], false);
    assert_eq!(body["version"], env!("CARGO_PKG_VERSION"));
}

#[tokio::test]
async fn engine_unavailable_is_503() {
    let (s, _) = state("unavail");
    let (status, _, body) = get(&s, "/api/v1/torrents").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["error"]["kind"], "engine_unavailable");
    assert_eq!(body["error"]["message"], "no engine in test");
}

#[tokio::test]
async fn torrent_errors_with_real_engine() {
    let dir = tmpdir("rqbit");
    let config = test_config(&dir);
    let engine = AppState::start_engine(&config, &dir.join("data")).await;
    let s = state_with(&dir, config, engine, HOST.parse().unwrap());

    let (status, _, body) = get(&s, &format!("/api/v1/torrents/{ZERO_ID}")).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["kind"], "not_found");

    let (status, _, body) = call(
        &s,
        json_req(
            Method::POST,
            "/api/v1/torrents",
            &json!({ "uri": "not-a-magnet" }),
        ),
    )
    .await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["kind"], "invalid_input");

    let (status, _, body) = get(&s, "/api/v1/torrents").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body, json!([]));

    s.engine.read().await.as_ref().unwrap().shutdown().await;
}

#[tokio::test]
async fn unknown_routes() {
    let (s, _) = state("routes");
    let (status, _, body) = get(&s, "/api/v1/nope").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["kind"], "not_found");
    let (status, _, body) = get(&s, "/api/nope").await;
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(body["error"]["kind"], "not_found");
}

#[tokio::test]
async fn ui_spa_fallback() {
    let (s, _) = state("ui");
    for path in ["/", "/some/client/route"] {
        let r = api::router(s.clone())
            .oneshot(req(Method::GET, path).body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(r.status(), StatusCode::OK, "{path}");
        assert_eq!(r.headers()[header::CONTENT_TYPE], "text/html", "{path}");
    }
}

#[tokio::test]
async fn settings_get_redacts_passwords() {
    let (s, _) = state("redact");
    {
        let mut c = s.config.write().await;
        c.auth = config::AuthConfig {
            enabled: true,
            username: "admin".into(),
            password_hash: auth::hash_password("pw"),
        };
        c.engine.transmission.password = "secret".into();
    }
    let token = s.sessions.create();
    let r = req(Method::GET, "/api/v1/settings")
        .header(header::COOKIE, format!("tx_session={token}"))
        .body(Body::empty())
        .unwrap();
    let (status, _, body) = call(&s, r).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["auth"]["username"], "admin");
    let text = body.to_string();
    assert!(!text.contains("password\""), "{text}");
    assert!(!text.contains("argon2"), "{text}");
    assert!(!text.contains("secret"), "{text}");
    assert_eq!(body["engine"]["transmission"]["hasPassword"], true);
}

#[tokio::test]
async fn settings_put_validation_and_restart_flag() {
    let (s, _) = state("put");
    let (_, _, current) = get(&s, "/api/v1/settings").await;
    let before = std::fs::read_to_string(&s.config_path).unwrap();

    let mut bad = current.clone();
    bad["engine"]["kind"] = json!("transmission");
    bad["engine"]["transmission"]["host"] = json!("");
    let (status, _, body) = call(&s, json_req(Method::PUT, "/api/v1/settings", &bad)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["kind"], "invalid_input");
    assert_eq!(std::fs::read_to_string(&s.config_path).unwrap(), before);

    let mut port = current.clone();
    port["server"]["port"] = json!(8080);
    let (status, _, body) = call(&s, json_req(Method::PUT, "/api/v1/settings", &port)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["restartRequired"], true);
    let saved = Config::load_or_create(&s.config_path).unwrap();
    assert_eq!(saved.server.port, 8080);

    let (status, _, body) = call(&s, json_req(Method::PUT, "/api/v1/settings", &port)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["restartRequired"], false);
}

#[tokio::test]
async fn settings_switch_engine_live() {
    let (s, _) = state("switch");
    let (_, _, mut settings) = get(&s, "/api/v1/settings").await;
    settings["engine"]["kind"] = json!("transmission");
    let (status, _, _) = call(&s, json_req(Method::PUT, "/api/v1/settings", &settings)).await;
    assert_eq!(status, StatusCode::OK);
    let (_, _, health) = get(&s, "/api/v1/health").await;
    assert_eq!(health["engine"], "transmission");
    // Engine now runs; the configured daemon is unreachable.
    let (status, _, body) = get(&s, "/api/v1/torrents").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(
        body["error"]["message"]
            .as_str()
            .unwrap()
            .contains("cannot reach")
    );
}

#[tokio::test]
async fn auth_flow() {
    let (s, _) = state("auth");
    let (_, _, mut settings) = get(&s, "/api/v1/settings").await;

    // Enabling without a password is rejected.
    settings["auth"] = json!({ "enabled": true, "username": "admin" });
    let (status, _, _) = call(&s, json_req(Method::PUT, "/api/v1/settings", &settings)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

    // Enabling keeps the caller logged in via a fresh cookie.
    settings["auth"] = json!({ "enabled": true, "username": "admin", "password": "hunter2" });
    let (status, headers, _) = call(&s, json_req(Method::PUT, "/api/v1/settings", &settings)).await;
    assert_eq!(status, StatusCode::OK);
    let own = cookie(&headers).expect("cookie after enabling auth");
    let with_cookie = |c: &str| {
        req(Method::GET, "/api/v1/settings")
            .header(header::COOKIE, c)
            .body(Body::empty())
            .unwrap()
    };
    assert_eq!(call(&s, with_cookie(&own)).await.0, StatusCode::OK);

    // Anonymous: 401 on protected routes, health stays open.
    let (status, _, body) = get(&s, "/api/v1/torrents").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert_eq!(body["error"]["kind"], "unauthorized");
    let (status, _, body) = get(&s, "/api/v1/health").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["authRequired"], true);

    // Wrong password: 401, no cookie.
    let login = |u: &str, p: &str| {
        json_req(
            Method::POST,
            "/api/v1/auth/login",
            &json!({ "username": u, "password": p }),
        )
    };
    let (status, headers, _) = call(&s, login("admin", "nope")).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);
    assert!(cookie(&headers).is_none());
    let (status, _, _) = call(&s, login("root", "hunter2")).await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    // Right password: cookie works.
    let (status, headers, _) = call(&s, login("admin", "hunter2")).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    let set = headers[header::SET_COOKIE].to_str().unwrap();
    assert!(
        set.contains("HttpOnly") && set.contains("SameSite=Strict"),
        "{set}"
    );
    let c = cookie(&headers).unwrap();
    assert_eq!(call(&s, with_cookie(&c)).await.0, StatusCode::OK);

    // Logout kills the session.
    let r = req(Method::POST, "/api/v1/auth/logout")
        .header(header::COOKIE, &c)
        .body(Body::empty())
        .unwrap();
    assert_eq!(call(&s, r).await.0, StatusCode::NO_CONTENT);
    assert_eq!(call(&s, with_cookie(&c)).await.0, StatusCode::UNAUTHORIZED);

    // Basic auth for scripts.
    use base64::Engine as _;
    let basic = |p: &str| {
        let b = base64::engine::general_purpose::STANDARD.encode(format!("admin:{p}"));
        req(Method::GET, "/api/v1/settings")
            .header(header::AUTHORIZATION, format!("Basic {b}"))
            .body(Body::empty())
            .unwrap()
    };
    assert_eq!(call(&s, basic("hunter2")).await.0, StatusCode::OK);
    assert_eq!(call(&s, basic("wrong")).await.0, StatusCode::UNAUTHORIZED);

    // Handoff: one-time token → session cookie + redirect.
    let token = s.sessions.create_handoff();
    let uri = format!("/api/v1/auth/handoff?token={token}");
    let (status, headers, _) = get(&s, &uri).await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    let c = cookie(&headers).expect("handoff cookie");
    assert_eq!(call(&s, with_cookie(&c)).await.0, StatusCode::OK);
    let (status, headers, _) = get(&s, &uri).await;
    assert_eq!(status, StatusCode::SEE_OTHER);
    assert!(cookie(&headers).is_none(), "handoff token reused");
}

#[tokio::test]
async fn guards() {
    let (s, dir) = state("guards");

    // DNS rebinding: foreign Host on a loopback-bound server.
    let r = Request::get("/api/v1/health")
        .header(header::HOST, "evil.example:9977")
        .body(Body::empty())
        .unwrap();
    assert_eq!(call(&s, r).await.0, StatusCode::FORBIDDEN);
    for host in ["localhost:9977", "[::1]:9977", "127.0.0.1"] {
        let r = Request::get("/api/v1/health")
            .header(header::HOST, host)
            .body(Body::empty())
            .unwrap();
        assert_eq!(call(&s, r).await.0, StatusCode::OK, "{host}");
    }
    s.config.write().await.server.allowed_hosts = vec!["nas.lan".into()];
    let r = Request::get("/api/v1/health")
        .header(header::HOST, "nas.lan:9977")
        .body(Body::empty())
        .unwrap();
    assert_eq!(call(&s, r).await.0, StatusCode::OK);

    // CSRF: cross-site write rejected, same-origin write processed.
    let add = |origin: &str| {
        req(Method::POST, "/api/v1/torrents")
            .header(header::ORIGIN, origin)
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(r#"{"uri":"magnet:?xt=urn:btih:x"}"#))
            .unwrap()
    };
    let (status, headers, _) = call(&s, add("https://evil.example")).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert!(
        headers
            .keys()
            .all(|k| !k.as_str().starts_with("access-control-"))
    );
    assert_eq!(call(&s, add("null")).await.0, StatusCode::FORBIDDEN);
    // Reaches the handler (503: no engine), i.e. not blocked.
    assert_eq!(
        call(&s, add(&format!("http://{HOST}"))).await.0,
        StatusCode::SERVICE_UNAVAILABLE
    );

    // Non-loopback bind: any Host is accepted.
    let open = state_with(
        &dir,
        test_config(&dir),
        Err("x".into()),
        "0.0.0.0:9977".parse().unwrap(),
    );
    let r = Request::get("/api/v1/health")
        .header(header::HOST, "anything.example")
        .body(Body::empty())
        .unwrap();
    assert_eq!(call(&open, r).await.0, StatusCode::OK);
}

#[tokio::test]
async fn settings_sections_round_trip() {
    let (s, _) = state("sections");
    let (_, _, mut settings) = get(&s, "/api/v1/settings").await;
    assert_eq!(settings["preferences"]["language"], "en");
    assert_eq!(settings["network"]["maxUploadKBps"], 0);
    assert_eq!(settings["advanced"]["diskCacheMB"], 0);
    assert_eq!(settings["engine"]["transmission"]["path"], "/transmission/rpc");

    // Invalid enum value → invalid_input, nothing saved.
    let mut bad = settings.clone();
    bad["preferences"]["language"] = json!("xx");
    let (status, _, body) = call(&s, json_req(Method::PUT, "/api/v1/settings", &bad)).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["kind"], "invalid_input");

    // Proxy password is write-only and kept when omitted.
    settings["network"]["proxy"] = json!({
        "type": "socks5", "host": "proxy.lan", "port": 1080,
        "authRequired": true, "username": "u", "password": "pw"
    });
    settings["preferences"]["theme"] = json!("dark-blue");
    settings["network"]["maxDownloadKBps"] = json!(100);
    let (status, _, body) = call(&s, json_req(Method::PUT, "/api/v1/settings", &settings)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settings"]["network"]["proxy"]["hasPassword"], true);
    assert!(!body.to_string().contains("\"pw\""));
    let mut again = body["settings"].clone();
    again["network"]["proxy"].as_object_mut().unwrap().remove("hasPassword");
    let (status, _, _) = call(&s, json_req(Method::PUT, "/api/v1/settings", &again)).await;
    assert_eq!(status, StatusCode::OK);
    let saved = Config::load_or_create(&s.config_path).unwrap();
    assert_eq!(saved.network.proxy.password, "pw");
    assert_eq!(saved.network.max_download_kbps, 100);
    assert_eq!(saved.preferences.theme, config::Theme::DarkBlue);
}

#[tokio::test]
async fn tabs_endpoints() {
    let (s, _) = state("tabs");
    let (status, _, body) =
        call(&s, json_req(Method::POST, "/api/v1/tabs", &json!({ "name": "   " }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["kind"], "invalid_input");

    let (status, _, tab) =
        call(&s, json_req(Method::POST, "/api/v1/tabs", &json!({ "name": "Linux" }))).await;
    assert_eq!(status, StatusCode::CREATED);
    let tab_id = tab["id"].as_str().unwrap().to_string();

    let id = "ab".repeat(20);
    let set = |t: Value| json_req(Method::PUT, &format!("/api/v1/torrents/{id}/tab"), &json!({ "tabId": t }));
    assert_eq!(call(&s, set(json!(tab_id))).await.0, StatusCode::NO_CONTENT);
    assert_eq!(call(&s, set(json!("nope"))).await.0, StatusCode::NOT_FOUND);
    let (_, _, tabs) = get(&s, "/api/v1/tabs").await;
    assert_eq!(tabs, json!([{ "id": tab_id, "name": "Linux", "torrentIds": [id] }]));

    let (status, _, renamed) = call(
        &s,
        json_req(Method::PATCH, &format!("/api/v1/tabs/{tab_id}"), &json!({ "name": "Distros" })),
    )
    .await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(renamed["name"], "Distros");

    let del = |t: &str| req(Method::DELETE, &format!("/api/v1/tabs/{t}")).body(Body::empty()).unwrap();
    assert_eq!(call(&s, del(&tab_id)).await.0, StatusCode::NO_CONTENT);
    assert_eq!(call(&s, del(&tab_id)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(get(&s, "/api/v1/tabs").await.2, json!([]));
}

#[tokio::test]
async fn stats_without_engine() {
    let (s, _) = state("stats");
    let (status, _, body) = get(&s, "/api/v1/stats").await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(body["torrents"], 0);
    assert_eq!(body["ratio"], Value::Null);
    assert!(body["diskFree"].as_u64().unwrap() > 0, "{body}");
    assert!(body["diskTotal"].as_u64().unwrap() >= body["diskFree"].as_u64().unwrap());
    assert!(body["memoryBytes"].as_u64().unwrap() > 0, "{body}");
    assert!(body["cpuPercent"].is_number());
    // Capabilities need an engine.
    assert_eq!(get(&s, "/api/v1/capabilities").await.0, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn reveal_is_loopback_only() {
    let (s, _) = state("reveal");
    let uri = format!("/api/v1/torrents/{ZERO_ID}/reveal");
    let with_peer = |ip: &str| {
        let mut r = req(Method::POST, &uri).body(Body::empty()).unwrap();
        let peer: SocketAddr = format!("{ip}:5555").parse().unwrap();
        r.extensions_mut().insert(axum::extract::ConnectInfo(peer));
        r
    };
    let (status, _, body) = call(&s, with_peer("192.168.1.20")).await;
    assert_eq!(status, StatusCode::FORBIDDEN);
    assert_eq!(body["error"]["kind"], "forbidden");
    // Unknown peer is treated as remote.
    let r = req(Method::POST, &uri).body(Body::empty()).unwrap();
    assert_eq!(call(&s, r).await.0, StatusCode::FORBIDDEN);
    // Loopback reaches the engine (503 here: no engine).
    assert_eq!(call(&s, with_peer("127.0.0.1")).await.0, StatusCode::SERVICE_UNAVAILABLE);
}

#[tokio::test]
async fn new_mutations_are_guarded() {
    let (s, _) = state("guards2");
    let token_free = [
        (Method::POST, format!("/api/v1/torrents/{ZERO_ID}/verify")),
        (Method::POST, format!("/api/v1/torrents/{ZERO_ID}/reveal")),
        (Method::PUT, format!("/api/v1/torrents/{ZERO_ID}/files")),
        (Method::PUT, format!("/api/v1/torrents/{ZERO_ID}/tab")),
        (Method::PATCH, "/api/v1/tabs/t1".to_string()),
        (Method::POST, "/api/v1/tabs".to_string()),
        (Method::POST, "/api/v1/torrents/preview".to_string()),
        (Method::POST, "/api/v1/transmission/test".to_string()),
    ];
    for (m, uri) in token_free {
        let r = req(m.clone(), &uri)
            .header(header::ORIGIN, "https://evil.example")
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from("{}"))
            .unwrap();
        assert_eq!(call(&s, r).await.0, StatusCode::FORBIDDEN, "{m} {uri}");
    }
    // Auth applies to the new routes too.
    s.config.write().await.auth = config::AuthConfig {
        enabled: true,
        username: "a".into(),
        password_hash: auth::hash_password("b"),
    };
    for uri in ["/api/v1/tabs", "/api/v1/stats", "/api/v1/capabilities"] {
        assert_eq!(get(&s, uri).await.0, StatusCode::UNAUTHORIZED, "{uri}");
    }
}

#[test]
fn unsupported_maps_to_501() {
    let e = api::ApiError::from(torrentx_core::EngineError::unsupported("rqbit", "x"));
    let r = axum::response::IntoResponse::into_response(e);
    assert_eq!(r.status(), StatusCode::NOT_IMPLEMENTED);
}

#[tokio::test]
async fn start_reports_addr_in_use() {
    let dir = tmpdir("inuse");
    let taken = tokio::net::TcpListener::bind((Ipv4Addr::LOCALHOST, 0))
        .await
        .unwrap();
    let port = taken.local_addr().unwrap().port();
    let opts = ServerOptions {
        config_path: dir.join("config.toml"),
        data_dir: Some(dir.join("data")),
        bind_override: None,
        port_override: Some(port),
    };
    match start(opts).await {
        Err(StartError::AddrInUse(a)) => assert_eq!(a.port(), port),
        Err(e) => panic!("unexpected error {e}"),
        Ok(_) => panic!("started on a taken port"),
    }
}
