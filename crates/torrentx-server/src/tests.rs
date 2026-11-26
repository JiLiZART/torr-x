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
    // Offline: a running TorrentX already holds the default DHT port.
    c.advanced.dht = false;
    c.network.upnp = false;
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
    assert_eq!(status, StatusCode::NOT_FOUND, "{body}");
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

    // Detail actions rqbit cannot do are 501 `unsupported`; a bad web-seed URL is caught first.
    let post = |uri: String, body: Value| json_req(Method::POST, &uri, &body);
    let (status, _, body) = call(&s, post(format!("/api/v1/torrents/{ZERO_ID}/reannounce"), json!({}))).await;
    assert_eq!((status, body["error"]["kind"].as_str()), (StatusCode::NOT_IMPLEMENTED, Some("unsupported")));
    let seed = |url: &str| post(format!("/api/v1/torrents/{ZERO_ID}/web-seeds"), json!({ "url": url }));
    assert_eq!(call(&s, seed("https://mirror.example.org/x/")).await.0, StatusCode::NOT_IMPLEMENTED);
    assert_eq!(call(&s, seed("ftp://mirror.example.org/x/")).await.0, StatusCode::BAD_REQUEST);
    let (status, _, body) = call(&s, post("/api/v1/network/port-test".into(), json!({}))).await;
    assert_eq!((status, body["error"]["kind"].as_str()), (StatusCode::NOT_IMPLEMENTED, Some("unsupported")));
    // Files of an unknown torrent: 404 (from loopback; a remote peer gets 403 first).
    let file = |action: &str, ip: &str| {
        let mut r = req(Method::POST, &format!("/api/v1/torrents/{ZERO_ID}/files/99/{action}")).body(Body::empty()).unwrap();
        r.extensions_mut().insert(axum::extract::ConnectInfo(format!("{ip}:5555").parse::<SocketAddr>().unwrap()));
        r
    };
    for action in ["open", "reveal"] {
        assert_eq!(call(&s, file(action, "127.0.0.1")).await.0, StatusCode::NOT_FOUND, "{action}");
        assert_eq!(call(&s, file(action, "192.168.1.20")).await.0, StatusCode::FORBIDDEN, "{action}");
    }
    let (_, _, caps) = get(&s, "/api/v1/capabilities").await;
    let f = &caps["features"];
    assert_eq!((f["reannounce"]["supported"].as_bool(), f["webSeeds"]["supported"].as_bool()), (Some(false), Some(false)));
    assert_eq!((f["openFile"]["supported"].as_bool(), f["openFile"]["via"].as_str()), (Some(true), Some("server")));
    assert_eq!(f["addWebSeed"]["supported"], false);
    assert_eq!(f["portTest"]["supported"], false);
    assert_eq!(f["encryption"]["supported"], false);
    assert!(caps["version"].as_str().is_some_and(|v| !v.is_empty()), "{caps}");

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
    settings["preferences"]["appearance"] = json!({ "mode": "dark", "accent": "cyan" });
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
    assert_eq!(saved.preferences.appearance.accent, config::Accent::Cyan);
    assert!(body["settings"]["preferences"].get("theme").is_none());

    let mut sepia = body["settings"].clone();
    sepia["preferences"]["appearance"] = json!({ "mode": "sepia" });
    let (status, _, body) = call(&s, json_req(Method::PUT, "/api/v1/settings", &sepia)).await;
    assert_eq!((status, body["error"]["kind"].as_str()), (StatusCode::BAD_REQUEST, Some("invalid_input")));

    // An old client still sending `theme` is converted, not rejected.
    let mut legacy = again.clone();
    let prefs = legacy["preferences"].as_object_mut().unwrap();
    prefs.remove("appearance");
    prefs.insert("theme".into(), json!("light"));
    let (status, _, body) = call(&s, json_req(Method::PUT, "/api/v1/settings", &legacy)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settings"]["preferences"]["appearance"], json!({ "mode": "light", "accent": "green" }));
}

#[tokio::test]
async fn tabs_endpoints() {
    let (s, _) = state("tabs");
    let (_, _, body) = get(&s, "/api/v1/tabs").await;
    assert_eq!(body["grammarVersion"], 1);
    assert_eq!(body["tabs"].as_array().unwrap().len(), 5, "built-ins are seeded");
    assert_eq!(
        body["tabs"][0],
        json!({ "id": "all", "name": "All", "query": "", "order": 0, "pinned": true, "group": null })
    );

    // An unparseable query round-trips verbatim.
    let new = json!({ "query": "statu:active", "group": "Media" });
    let (status, _, tab) = call(&s, json_req(Method::POST, "/api/v1/tabs", &new)).await;
    assert_eq!(status, StatusCode::CREATED);
    let tab_id = tab["id"].as_str().unwrap().to_string();
    let (_, _, body) = get(&s, "/api/v1/tabs").await;
    assert_eq!(
        body["tabs"][5],
        json!({ "id": tab_id, "name": "", "query": "statu:active", "order": 5, "pinned": false, "group": "Media" })
    );

    let patch = |t: &str, body: Value| json_req(Method::PATCH, &format!("/api/v1/tabs/{t}"), &body);
    let (status, _, moved) =
        call(&s, patch(&tab_id, json!({ "name": "Distros", "order": 1, "pinned": true, "group": null }))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        moved,
        json!({ "id": tab_id, "name": "Distros", "query": "statu:active", "order": 1, "pinned": true, "group": null })
    );
    assert_eq!(call(&s, patch("nope", json!({ "name": "x" }))).await.0, StatusCode::NOT_FOUND);

    let del = |t: &str| req(Method::DELETE, &format!("/api/v1/tabs/{t}")).body(Body::empty()).unwrap();
    assert_eq!(call(&s, del(&tab_id)).await.0, StatusCode::NO_CONTENT);
    assert_eq!(call(&s, del(&tab_id)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(call(&s, del("all")).await.0, StatusCode::BAD_REQUEST);
    assert_eq!(get(&s, "/api/v1/tabs").await.2["tabs"].as_array().unwrap().len(), 5);
}

#[tokio::test]
async fn tags_endpoint() {
    let (s, _) = state("tags");
    let id = "ab".repeat(20);
    let set = |tags: Value| json_req(Method::PUT, &format!("/api/v1/torrents/{id}/tags"), &tags);
    assert_eq!(call(&s, set(json!([" 4K ", "4k", "Movies"]))).await.0, StatusCode::NO_CONTENT);
    assert_eq!(s.store.tags_of(&id), ["4k", "movies"]);

    let many: Vec<String> = (0..33).map(|i| format!("t{i}")).collect();
    let (status, _, body) = call(&s, set(json!(many))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(body["error"]["kind"], "invalid_input");
    assert_eq!(s.store.tags_of(&id), ["4k", "movies"]);

    let bad_id = json_req(Method::PUT, "/api/v1/torrents/nope/tags", &json!([]));
    assert_eq!(call(&s, bad_id).await.0, StatusCode::NOT_FOUND);

    // The old membership route points at the new one.
    let old = json_req(Method::PUT, &format!("/api/v1/torrents/{id}/tab"), &json!({ "tabId": null }));
    let (status, _, body) = call(&s, old).await;
    assert_eq!(status, StatusCode::GONE);
    assert!(body["error"]["message"].as_str().unwrap().contains("/tags"));

    let cat = |body: Value| json_req(Method::PUT, &format!("/api/v1/torrents/{id}/category"), &body);
    assert_eq!(call(&s, cat(json!({ "category": " Movies " }))).await.0, StatusCode::NO_CONTENT);
    assert_eq!(s.store.category_of(&id).as_deref(), Some("Movies"));
    let (status, _, _) = call(&s, cat(json!({ "category": "x".repeat(65) }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);
    assert_eq!(call(&s, cat(json!({ "category": null }))).await.0, StatusCode::NO_CONTENT);
    assert_eq!(s.store.category_of(&id), None);
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
    assert_eq!(body["dhtNodes"], Value::Null);
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
        (Method::POST, format!("/api/v1/torrents/{ZERO_ID}/reannounce")),
        (Method::POST, format!("/api/v1/torrents/{ZERO_ID}/web-seeds")),
        (Method::POST, format!("/api/v1/torrents/{ZERO_ID}/files/0/open")),
        (Method::POST, format!("/api/v1/torrents/{ZERO_ID}/files/0/reveal")),
        (Method::POST, format!("/api/v1/torrents/{ZERO_ID}/files/0/stream")),
        (Method::POST, format!("/api/v1/torrents/{ZERO_ID}/files/0/play")),
        (Method::PUT, format!("/api/v1/torrents/{ZERO_ID}/files")),
        (Method::PUT, format!("/api/v1/torrents/{ZERO_ID}/tags")),
        (Method::PUT, format!("/api/v1/torrents/{ZERO_ID}/category")),
        (Method::PATCH, "/api/v1/tabs/t1".to_string()),
        (Method::POST, "/api/v1/tabs".to_string()),
        (Method::POST, "/api/v1/torrents/preview".to_string()),
        (Method::POST, "/api/v1/transmission/test".to_string()),
        (Method::POST, "/api/v1/network/port-test".to_string()),
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
    for uri in [
        format!("/api/v1/torrents/{ZERO_ID}/reannounce"),
        format!("/api/v1/torrents/{ZERO_ID}/files/0/open"),
        format!("/api/v1/torrents/{ZERO_ID}/files/0/stream"),
        format!("/api/v1/torrents/{ZERO_ID}/files/0/play"),
        "/api/v1/network/port-test".into(),
    ] {
        let r = req(Method::POST, &uri).body(Body::empty()).unwrap();
        assert_eq!(call(&s, r).await.0, StatusCode::UNAUTHORIZED, "{uri}");
    }
}

#[tokio::test]
async fn stream_links_need_a_live_token_not_a_login() {
    let (s, _) = state("stream");
    s.config.write().await.auth = config::AuthConfig {
        enabled: true,
        username: "a".into(),
        password_hash: auth::hash_password("b"),
    };
    // An unknown token is 404, never 401: the token is the credential.
    assert_eq!(get(&s, "/api/v1/stream/nope/x.mkv").await.0, StatusCode::NOT_FOUND);
    // A live token passes auth and reaches the engine (503 here: no engine).
    let token = s.sessions.create_stream(ZERO_ID, 0);
    assert_eq!(get(&s, &format!("/api/v1/stream/{token}/x.mkv")).await.0, StatusCode::SERVICE_UNAVAILABLE);
    // Logging everyone out also revokes stream links.
    s.sessions.clear();
    assert_eq!(get(&s, &format!("/api/v1/stream/{token}/x.mkv")).await.0, StatusCode::NOT_FOUND);
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

/// A Transmission daemon stub answering every RPC with the recorded `torrent-get` fixture plus one
/// magnet without metadata: enough for `list` and `files_all`.
async fn transmission_stub() -> String {
    let mut out: Value = serde_json::from_str(include_str!(
        "../../torrentx-transmission/tests/fixtures/torrent-get.json"
    ))
    .unwrap();
    let mut magnet = out["arguments"]["torrents"][0].clone();
    magnet["hashString"] = json!("b".repeat(40));
    magnet["name"] = json!("unresolved magnet");
    magnet["files"] = json!([]);
    magnet["fileStats"] = json!([]);
    out["arguments"]["torrents"].as_array_mut().unwrap().push(magnet);
    let body = out.to_string();
    let app = axum::Router::new().route(
        "/transmission/rpc",
        axum::routing::post(move || {
            let body = body.clone();
            async move { ([(header::CONTENT_TYPE, "application/json")], body) }
        }),
    );
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let url = format!("http://{}/transmission/rpc", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    url
}

async fn files_state(name: &str) -> Arc<AppState> {
    let dir = tmpdir(name);
    let url = transmission_stub().await;
    let engine = torrentx_transmission::TransmissionEngine::new(&url, "", "");
    state_with(
        &dir,
        test_config(&dir),
        Ok(Arc::new(engine::Engine::Transmission(engine))),
        HOST.parse().unwrap(),
    )
}

#[tokio::test]
async fn files_flattens_every_torrent_and_skips_unresolved() {
    let s = files_state("files").await;
    let (status, _, body) = get(&s, "/api/v1/files").await;
    assert_eq!(status, StatusCode::OK, "{body}");
    let hits = body.as_array().unwrap();
    // The fixture torrent has 3 files; the magnet without metadata contributes none.
    assert_eq!(hits.len(), 3, "{body}");
    let id = "c14331f3bdd54f0a6e393e867756f7fe332839d0";
    assert!(hits.iter().all(|h| h["torrentId"] == id));
    assert_eq!(
        hits.iter().map(|h| h["index"].as_u64().unwrap()).collect::<Vec<_>>(),
        [0, 1, 2]
    );
    assert_eq!(hits[0]["path"], "tx-fixture/a.txt");
    assert_eq!(hits[1]["wanted"], false);
    assert_eq!(hits[1]["priority"], "low");
}

#[tokio::test]
async fn files_carry_the_rename_override() {
    let s = files_state("files-renamed").await;
    s.store
        .set_name("c14331f3bdd54f0a6e393e867756f7fe332839d0", "Renamed")
        .unwrap();
    let (_, _, body) = get(&s, "/api/v1/files").await;
    assert!(body.as_array().unwrap().iter().all(|h| h["torrentName"] == "Renamed"), "{body}");
}

#[tokio::test]
async fn files_needs_auth_and_an_engine() {
    let s = files_state("files-auth").await;
    s.config.write().await.auth = config::AuthConfig {
        enabled: true,
        username: "admin".into(),
        password_hash: auth::hash_password("pw"),
    };
    let (status, _, _) = get(&s, "/api/v1/files").await;
    assert_eq!(status, StatusCode::UNAUTHORIZED);

    let (s, _) = state("files-noengine");
    let (status, _, body) = get(&s, "/api/v1/files").await;
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(body["error"]["kind"], "engine_unavailable");
}
