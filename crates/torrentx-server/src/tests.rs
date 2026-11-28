use std::net::{IpAddr, Ipv4Addr, SocketAddr};

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

#[tokio::test]
async fn start_reports_forbidden_port() {
    let dir = tmpdir("forbidden");
    let opts = ServerOptions {
        config_path: dir.join("config.toml"),
        data_dir: Some(dir.join("data")),
        bind_override: Some(IpAddr::V4(Ipv4Addr::LOCALHOST)),
        port_override: Some(1),
    };
    // Port 1 needs privileges on Linux (CI); macOS and root allow it, so only the error kind is checked.
    match start(opts).await {
        Err(StartError::Forbidden(a)) => assert_eq!(a.port(), 1),
        Ok(server) => server.shutdown().await,
        Err(StartError::AddrInUse(_)) => {}
        Err(e) => panic!("unexpected error {e}"),
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
    rpc_stub(out.to_string()).await
}

/// Serves `body` for every Transmission RPC; returns the RPC URL.
async fn rpc_stub(body: String) -> String {
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

// ---- covers ---------------------------------------------------------------------

const COVER_ID: &str = "c14331f3bdd54f0a6e393e867756f7fe332839d0";
const JPEG: &[u8] = &[0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3];
const PNG: &[u8] = b"\x89PNG\r\n\x1a\n-still-";

/// One torrent on a Transmission stub with `files` as (path, size, bytes done), saved under
/// `<dir>/dl`. Files are not created on disk.
async fn cover_state(name: &str, files: &[(&str, u64, u64)], tmdb: Option<covers::Tmdb>) -> (Arc<AppState>, PathBuf) {
    let dir = tmpdir(name);
    let mut out: Value =
        serde_json::from_str(include_str!("../../torrentx-transmission/tests/fixtures/torrent-get.json")).unwrap();
    let t = &mut out["arguments"]["torrents"][0];
    t["name"] = json!("Big.Buck.Bunny.2008.1080p.x264-GRP");
    t["downloadDir"] = json!(dir.join("dl"));
    t["files"] = files.iter().map(|(p, len, done)| json!({ "name": p, "length": len, "bytesCompleted": done })).collect();
    t["fileStats"] = files.iter().map(|(_, _, done)| json!({ "bytesCompleted": done, "priority": 0, "wanted": true })).collect();
    let engine = torrentx_transmission::TransmissionEngine::new(&rpc_stub(out.to_string()).await, "", "");
    let config = test_config(&dir);
    let config_path = dir.join("config.toml");
    config.save(&config_path).unwrap();
    let engine = Ok(Arc::new(engine::Engine::Transmission(engine)));
    let mut state = AppState::new(config, config_path, dir.join("data"), engine, HOST.parse().unwrap()).unwrap();
    if let Some(tmdb) = tmdb {
        state.tmdb = tmdb;
    }
    (Arc::new(state), dir)
}

fn write_file(dir: &std::path::Path, path: &str, bytes: &[u8]) {
    let path = dir.join("dl").join(path);
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, bytes).unwrap();
}

/// One policy-tick step for covers.
async fn cover_tick(s: &Arc<AppState>) {
    let engine = s.engine.read().await.clone().unwrap();
    let list = engine.list().await.unwrap();
    covers::tick(s, &engine, &list, &mut Default::default()).await;
}

async fn raw(state: &Arc<AppState>, uri: &str) -> (StatusCode, HeaderMap, Vec<u8>) {
    let r = req(Method::GET, uri).body(Body::empty()).unwrap();
    let (parts, body) = api::router(state.clone()).oneshot(r).await.unwrap().into_parts();
    (parts.status, parts.headers, body.collect().await.unwrap().to_bytes().to_vec())
}

async fn put_frame(s: &Arc<AppState>, index: u32, bytes: &[u8]) -> (StatusCode, Value) {
    let uri = format!("/api/v1/torrents/{COVER_ID}/files/{index}/cover");
    let (status, _, body) = call(s, req(Method::PUT, &uri).body(Body::from(bytes.to_vec())).unwrap()).await;
    (status, body)
}

async fn torrent_cover(s: &Arc<AppState>) -> Value {
    get(s, "/api/v1/torrents").await.2[0]["cover"].clone()
}

async fn file_cover(s: &Arc<AppState>, index: usize) -> Value {
    get(s, &format!("/api/v1/torrents/{COVER_ID}")).await.2["files"][index]["cover"].clone()
}

async fn delete(s: &Arc<AppState>, uri: &str) -> StatusCode {
    call(s, req(Method::DELETE, uri).body(Body::empty()).unwrap()).await.0
}

const FILM: &[(&str, u64, u64)] = &[
    ("film/poster.jpg", 7, 7),
    ("film/a.mkv", 1000, 0),
    ("film/b.mkv", 2000, 0),
    ("film/notes.txt", 5, 5),
    ("film/evil.jpg", 9, 9),
];

#[tokio::test]
async fn cover_from_an_image_file_of_the_torrent() {
    // Still downloading: no cover, and the endpoint says so.
    let (s, _) = cover_state("cover-pending", &[("film/poster.jpg", 7, 3), ("film/a.mkv", 1000, 0)], None).await;
    cover_tick(&s).await;
    assert_eq!(torrent_cover(&s).await, Value::Null);
    let (status, _, body) = get(&s, &format!("/api/v1/torrents/{COVER_ID}/cover")).await;
    assert_eq!((status, body["error"]["kind"].as_str()), (StatusCode::NOT_FOUND, Some("not_found")));

    let (s, dir) = cover_state("cover-poster", FILM, None).await;
    write_file(&dir, "film/poster.jpg", JPEG);
    write_file(&dir, "film/evil.jpg", b"<svg><script>1</script></svg>");
    assert_eq!(torrent_cover(&s).await, Value::Null, "set by the policy tick, not by a request");
    cover_tick(&s).await;
    assert_eq!(torrent_cover(&s).await, "f0-7");
    // Removed and added again between two ticks: the cover is picked again.
    let engine = s.engine.read().await.clone().unwrap();
    let mut memo = Default::default();
    covers::tick(&s, &engine, &engine.list().await.unwrap(), &mut memo).await;
    s.store.forget(COVER_ID).unwrap();
    assert_eq!(torrent_cover(&s).await, Value::Null);
    covers::tick(&s, &engine, &engine.list().await.unwrap(), &mut memo).await;
    assert_eq!(torrent_cover(&s).await, "f0-7");

    let cover = format!("/api/v1/torrents/{COVER_ID}/cover");
    let (status, h, body) = raw(&s, &format!("{cover}?v=f0-7")).await;
    assert_eq!((status, body.as_slice()), (StatusCode::OK, JPEG));
    assert_eq!(h[header::CONTENT_TYPE], "image/jpeg");
    assert_eq!(h[header::X_CONTENT_TYPE_OPTIONS], "nosniff");
    assert_eq!(h[header::CONTENT_SECURITY_POLICY], "default-src 'none'; sandbox");
    assert!(h[header::CACHE_CONTROL].to_str().unwrap().contains("immutable"));
    // Without the current version the answer must not be kept.
    assert_eq!(raw(&s, &cover).await.1[header::CACHE_CONTROL], "no-cache");
    assert_eq!(raw(&s, &format!("{cover}?v=old")).await.1[header::CACHE_CONTROL], "no-cache");

    // An image file is its own cover; other files have none; a fake image is never served.
    assert_eq!(file_cover(&s, 0).await, "f0-7");
    assert_eq!(file_cover(&s, 3).await, Value::Null);
    let file = |i: u32| format!("/api/v1/torrents/{COVER_ID}/files/{i}/cover");
    assert_eq!(raw(&s, &file(0)).await.2, JPEG);
    assert_eq!(raw(&s, &file(3)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(raw(&s, &file(4)).await.0, StatusCode::NOT_FOUND);
    assert_eq!(raw(&s, &file(99)).await.0, StatusCode::NOT_FOUND);

    // A frame gives the video file a cover; the torrent keeps its own image.
    let (status, body) = put_frame(&s, 2, PNG).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(file_cover(&s, 2).await, body["cover"]);
    assert_eq!(raw(&s, &file(2)).await.1[header::CONTENT_TYPE], "image/png");
    assert_eq!(torrent_cover(&s).await, "f0-7");
}

#[tokio::test]
async fn uploaded_frames_and_removal() {
    let (s, _) = cover_state("cover-frames", &FILM[1..4], None).await;
    cover_tick(&s).await;
    assert_eq!(torrent_cover(&s).await, Value::Null);

    for (index, bytes) in [(0, &b"just text"[..]), (0, b"GIF89a.."), (0, b"<svg/>"), (2, JPEG), (99, JPEG)] {
        let (status, body) = put_frame(&s, index, bytes).await;
        assert_eq!((status, body["error"]["kind"].as_str()), (StatusCode::BAD_REQUEST, Some("invalid_input")), "{index}");
    }
    let mut big = JPEG.to_vec();
    big.resize(512 * 1024 + 1, 0);
    assert_eq!(put_frame(&s, 0, &big).await.0, StatusCode::BAD_REQUEST);
    assert_eq!(s.store.covers(COVER_ID), covers::CoverRec::default(), "nothing stored");

    // The smaller video's frame is only that file's cover; the largest one's is the torrent's too.
    let (_, small) = put_frame(&s, 0, JPEG).await;
    assert_eq!((file_cover(&s, 0).await, torrent_cover(&s).await), (small["cover"].clone(), Value::Null));
    let (_, first) = put_frame(&s, 1, JPEG).await;
    assert_eq!(torrent_cover(&s).await, first["cover"]);
    let (_, second) = put_frame(&s, 1, PNG).await;
    assert_ne!(first["cover"], second["cover"], "the version changes with the image");
    assert_eq!(torrent_cover(&s).await, second["cover"]);
    let (status, h, body) = raw(&s, &format!("/api/v1/torrents/{COVER_ID}/cover")).await;
    assert_eq!((status, h[header::CONTENT_TYPE].to_str().unwrap(), body.as_slice()), (StatusCode::OK, "image/png", PNG));

    // Removed covers stay removed: a later frame sets the file's cover only.
    assert_eq!(delete(&s, &format!("/api/v1/torrents/{COVER_ID}/cover")).await, StatusCode::NO_CONTENT);
    assert_eq!(torrent_cover(&s).await, Value::Null);
    let (_, again) = put_frame(&s, 1, JPEG).await;
    assert_eq!((file_cover(&s, 1).await, torrent_cover(&s).await), (again["cover"].clone(), Value::Null));
    assert_eq!(delete(&s, &format!("/api/v1/torrents/{COVER_ID}/files/1/cover")).await, StatusCode::NO_CONTENT);
    assert_eq!(file_cover(&s, 1).await, Value::Null);
    assert_eq!(put_frame(&s, 1, JPEG).await.1["cover"], Value::Null);
    assert_eq!(file_cover(&s, 1).await, Value::Null);
    assert_eq!(delete(&s, &format!("/api/v1/torrents/{COVER_ID}/files/99/cover")).await, StatusCode::NOT_FOUND);

    // Removing the torrent drops its record and its cached images.
    let cache = s.data_dir.join("covers").join(COVER_ID);
    assert!(cache.join("f0.jpg").exists());
    assert_eq!(delete(&s, &format!("/api/v1/torrents/{COVER_ID}")).await, StatusCode::NO_CONTENT);
    assert_eq!(s.store.covers(COVER_ID), covers::CoverRec::default());
    assert!(!cache.exists());
}

/// A stand-in for TMDB that records every request line it gets.
async fn tmdb_stub() -> (covers::Tmdb, Arc<std::sync::Mutex<Vec<String>>>) {
    let seen = Arc::new(std::sync::Mutex::new(Vec::new()));
    let log = seen.clone();
    let app = axum::Router::new().fallback(move |uri: axum::http::Uri| {
        log.lock().unwrap().push(uri.to_string());
        async move {
            let json = |v: Value| ([(header::CONTENT_TYPE, "application/json")], v.to_string()).into_response();
            use axum::response::IntoResponse;
            match uri.path() {
                "/3/search/movie" | "/3/search/tv" => json(json!({ "results": [{ "id": 7, "poster_path": "/p.jpg" }] })),
                "/3/tv/7/season/1/episode/2" => json(json!({ "still_path": "/s.jpg" })),
                "/img/w780/p.jpg" => JPEG.into_response(),
                "/img/w300/s.jpg" => PNG.into_response(),
                _ => StatusCode::NOT_FOUND.into_response(),
            }
        }
    });
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let base = format!("http://{}", listener.local_addr().unwrap());
    tokio::spawn(async move { axum::serve(listener, app).await.unwrap() });
    (covers::Tmdb { api: format!("{base}/3"), images: format!("{base}/img") }, seen)
}

async fn lookup(s: &Arc<AppState>, body: Value) -> (StatusCode, Value) {
    let uri = format!("/api/v1/torrents/{COVER_ID}/cover/lookup");
    let (status, _, body) = call(s, json_req(Method::POST, &uri, &body)).await;
    (status, body)
}

async fn enable_lookup(s: &Arc<AppState>) {
    let (_, _, mut settings) = get(s, "/api/v1/settings").await;
    assert_eq!(settings["covers"], json!({ "onlineLookup": false, "hasApiKey": false }));
    settings["covers"] = json!({ "onlineLookup": true, "apiKey": "k3y-s3cret" });
    let (status, _, body) = call(s, json_req(Method::PUT, "/api/v1/settings", &settings)).await;
    assert_eq!(status, StatusCode::OK, "{body}");
    assert_eq!(body["settings"]["covers"], json!({ "onlineLookup": true, "hasApiKey": true }));
    assert!(!body.to_string().contains("k3y-s3cret"));
}

#[tokio::test]
async fn cover_lookup_is_opt_in_and_sends_only_the_title() {
    let (tmdb, seen) = tmdb_stub().await;
    let (s, _) = cover_state("cover-lookup", &FILM[1..4], Some(tmdb)).await;
    let movie = json!({ "kind": "movie", "title": "Big Buck Bunny", "year": 2008 });

    // Off by default: refused, and nothing leaves the machine.
    let (status, body) = lookup(&s, movie.clone()).await;
    assert_eq!((status, body["error"]["kind"].as_str()), (StatusCode::NOT_IMPLEMENTED, Some("unsupported")));
    cover_tick(&s).await;
    assert!(seen.lock().unwrap().is_empty());

    // The key is write-only, and a later save without it keeps it.
    enable_lookup(&s).await;
    let (_, _, settings) = get(&s, "/api/v1/settings").await;
    assert!(!settings.to_string().contains("k3y-s3cret"));
    let (status, _, _) = call(&s, json_req(Method::PUT, "/api/v1/settings", &settings)).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(Config::load_or_create(&s.config_path).unwrap().covers.api_key, "k3y-s3cret");

    // A poster replaces a captured frame.
    let (_, frame) = put_frame(&s, 1, PNG).await;
    assert_eq!(torrent_cover(&s).await, frame["cover"]);
    let (status, found) = lookup(&s, movie.clone()).await;
    assert_eq!(status, StatusCode::OK, "{found}");
    assert!(found["cover"].is_string() && found["cover"] != frame["cover"], "{found}");
    assert_eq!(torrent_cover(&s).await, found["cover"]);
    assert_eq!(raw(&s, &format!("/api/v1/torrents/{COVER_ID}/cover")).await.2, JPEG);

    // Only the title and the year went out (plus the key the service needs).
    let sent = seen.lock().unwrap().join("\n");
    assert!(sent.contains("query=Big+Buck+Bunny") && sent.contains("year=2008"), "{sent}");
    for private in [COVER_ID, "1080p", "x264", "GRP", "mkv", "film"] {
        assert!(!sent.contains(private), "{private} in {sent}");
    }

    // Asked once: the stored answer comes back with no new request.
    let before = seen.lock().unwrap().len();
    assert_eq!(lookup(&s, movie.clone()).await.1, found);
    assert_eq!(seen.lock().unwrap().len(), before);

    // An episode image is that file's cover, and a later frame does not replace it.
    let episode = json!({ "kind": "tv", "title": "Show", "season": 1, "episode": 2, "file": 0 });
    let (status, still) = lookup(&s, episode).await;
    assert_eq!(status, StatusCode::OK, "{still}");
    assert_eq!(file_cover(&s, 0).await, still["cover"]);
    assert!(seen.lock().unwrap().iter().any(|u| u.starts_with("/3/tv/7/season/1/episode/2")));
    assert_eq!(raw(&s, &format!("/api/v1/torrents/{COVER_ID}/files/0/cover")).await.2, PNG);
    assert_eq!(put_frame(&s, 0, JPEG).await.1, still);
    assert_eq!(torrent_cover(&s).await, found["cover"]);

    for bad in [
        json!({ "kind": "movie", "title": "X", "file": 0 }),
        json!({ "kind": "tv", "title": "X", "season": 1, "file": 1 }),
        json!({ "kind": "tv", "title": " " }),
        json!({ "kind": "tv", "title": "X", "season": 1, "episode": 1, "file": 2 }),
    ] {
        assert_eq!(lookup(&s, bad.clone()).await.0, StatusCode::BAD_REQUEST, "{bad}");
    }
}

#[tokio::test]
async fn cover_lookup_never_replaces_a_local_or_removed_cover() {
    let (tmdb, seen) = tmdb_stub().await;
    let (s, dir) = cover_state("cover-local", FILM, Some(tmdb)).await;
    write_file(&dir, "film/poster.jpg", JPEG);
    enable_lookup(&s).await;
    cover_tick(&s).await;
    let movie = json!({ "kind": "movie", "title": "Big Buck Bunny" });
    assert_eq!(lookup(&s, movie.clone()).await.1, json!({ "cover": "f0-7" }));
    assert!(seen.lock().unwrap().is_empty(), "no request when the torrent has its own image");

    assert_eq!(delete(&s, &format!("/api/v1/torrents/{COVER_ID}/cover")).await, StatusCode::NO_CONTENT);
    assert_eq!(lookup(&s, movie).await.1, json!({ "cover": null }));
    cover_tick(&s).await;
    assert_eq!(torrent_cover(&s).await, Value::Null, "the tick does not bring it back either");
    assert!(seen.lock().unwrap().is_empty());
}

#[tokio::test]
async fn login_lockout_and_session_kinds() {
    let (s, _) = state("lockout");
    {
        let mut c = s.config.write().await;
        c.auth = config::AuthConfig { enabled: true, username: "admin".into(), password_hash: auth::hash_password("pw") };
    }
    let from = |ip: &str, body: Value| {
        let mut r = json_req(Method::POST, "/api/v1/auth/login", &body);
        r.extensions_mut().insert(axum::extract::ConnectInfo(format!("{ip}:5555").parse::<SocketAddr>().unwrap()));
        r
    };
    // The sign-in screen sends only the password; plain sessions get a browser-session cookie.
    let (status, headers, _) = call(&s, from("10.0.0.1", json!({ "password": "pw" }))).await;
    assert_eq!(status, StatusCode::NO_CONTENT);
    assert!(!headers[header::SET_COOKIE].to_str().unwrap().contains("Max-Age"));
    let own = cookie(&headers).unwrap();
    let (_, headers, _) = call(&s, from("10.0.0.1", json!({ "password": "pw", "remember": true }))).await;
    assert!(headers[header::SET_COOKIE].to_str().unwrap().contains("Max-Age=2592000"));

    for left in [4, 3, 2, 1] {
        let (status, headers, body) = call(&s, from("10.0.0.1", json!({ "password": "nope" }))).await;
        assert_eq!((status, body["error"]["attemptsLeft"].as_u64()), (StatusCode::UNAUTHORIZED, Some(left)));
        assert!(cookie(&headers).is_none());
    }
    let (status, _, body) = call(&s, from("10.0.0.1", json!({ "password": "nope" }))).await;
    assert_eq!((status, body["error"]["kind"].as_str()), (StatusCode::TOO_MANY_REQUESTS, Some("locked_out")));
    // Locked: even the right password is refused, with Retry-After; Basic from there too.
    let (status, headers, body) = call(&s, from("10.0.0.1", json!({ "password": "pw" }))).await;
    assert_eq!(status, StatusCode::TOO_MANY_REQUESTS);
    assert!(cookie(&headers).is_none());
    assert!(body["error"]["retryAfterSecs"].as_u64().is_some_and(|n| (1..=60).contains(&n)));
    assert!(headers.contains_key(header::RETRY_AFTER));
    use base64::Engine as _;
    let mut basic = req(Method::GET, "/api/v1/settings")
        .header(header::AUTHORIZATION, format!("Basic {}", base64::engine::general_purpose::STANDARD.encode("admin:pw")))
        .body(Body::empty())
        .unwrap();
    basic.extensions_mut().insert(axum::extract::ConnectInfo("10.0.0.1:5555".parse::<SocketAddr>().unwrap()));
    assert_eq!(call(&s, basic).await.0, StatusCode::TOO_MANY_REQUESTS);
    // A valid cookie still works, and other addresses are not affected.
    let mut with_cookie = req(Method::GET, "/api/v1/settings").header(header::COOKIE, &own).body(Body::empty()).unwrap();
    with_cookie.extensions_mut().insert(axum::extract::ConnectInfo("10.0.0.1:5555".parse::<SocketAddr>().unwrap()));
    assert_eq!(call(&s, with_cookie).await.0, StatusCode::OK);
    assert_eq!(call(&s, from("10.0.0.2", json!({ "password": "pw" }))).await.0, StatusCode::NO_CONTENT);
}
