## Context

See proposal.md – Why. Current state that shapes the approach:

- `src-tauri/src/backend/mod.rs` declares a **sync** `TorrentBackend` trait while `rqbit.rs`/`transmission.rs` implement it with `async fn` + `#[async_trait]`, and `TransmissionRPC::send_request` takes `&mut self` from `&self` methods – the backend does not compile, which is why `lib.rs` has it all commented out.
- The Transmission status mapping in `transmission.rs` is off by one (Transmission: 0 stopped, 1 check-wait, 2 check, 3 download-wait, 4 download, 5 seed-wait, 6 seed).
- `src/lib/torrent-api.ts` imports `invoke` from `@tauri-apps/api/tauri` (Tauri v1 path, removed in v2).
- `rqbit.rs` is a stub; nothing uses librqbit yet.
- No existing specs, no tests, no `lint` script despite CLAUDE.md referencing one.

User decisions: server runs **in-process** in the desktop app; default **localhost, no auth**, auth configurable in settings; **one engine per server**.

## Goals / Non-Goals

**Goals:**
- One server library used by both the headless binary and the desktop app – no duplicated engine/API code.
- Single self-contained `torrentx-server` binary (UI embedded).
- Web UI is the only UI; the desktop app is a thin tray + webview shell around it.

**Non-Goals:**
- Real-time push (SSE/WebSocket) – polling is enough for v1.
- Generated TS types from Rust.
- Persisting login sessions across server restarts.
- Tauri IPC commands of any kind.

## Decisions

### D1. Layout

```
apps/
  web/                 React 19 + Vite + Tailwind (moved from src/)
  desktop/             Tauri 2 app
    src/index.html     tiny "starting…/error" page (Tauri frontendDist)
    src-tauri/         Rust crate `torrentx-desktop` (workspace member)
crates/
  torrentx-core/        shared model (Torrent, TorrentDetails, FileInfo, Status), EngineError
  torrentx-rqbit/       RqbitEngine (librqbit)
  torrentx-transmission/ TransmissionEngine (reqwest RPC)
  torrentx-server/      lib: config, engine dispatch, axum router, auth, embedded UI
                        bin: torrentx-server (clap CLI → lib)
packages/
  api-client/          @torrentx/api-client – typed fetch wrapper + TS model types
packaging/
  systemd/torrentx.service
Cargo.toml             [workspace] members = ["crates/*", "apps/desktop/src-tauri"]
pnpm-workspace.yaml    apps/*, packages/*
```

Files are moved with `git mv` to keep history. Separate engine crates were explicitly requested and keep librqbit's heavy dependency tree out of the Transmission-only build path.

### D2. Engine dispatch: enum, not trait object
There are exactly two engines and the set is closed. `torrentx-server` defines `enum Engine { Rqbit(RqbitEngine), Transmission(TransmissionEngine) }` with async inherent methods that `match` and delegate. Both engine crates expose the same inherent method names and return `torrentx_core` types.
*Alternative:* `#[async_trait] trait TorrentBackend` + `Arc<dyn …>` – adds boxing and a dependency for no benefit with two impls; also the thing that broke the current code.

### D3. Hot-swappable engine state
`AppState { engine: RwLock<EngineSlot>, config: RwLock<Config>, sessions, config_path }` where `EngineSlot = Result<Engine, String>` (Err holds the start-up failure message → `engine_unavailable`). Settings PUT with an engine change: build the new engine first, then take the write lock, swap, and `shutdown()` the old one outside the lock. If the new engine fails, keep the slot as `Err(msg)` and still persist settings (the user asked for it; the UI shows the banner).

### D4. Torrent id = info-hash hex
Stable across engines and restarts. Transmission accepts `hashString` in `ids`; librqbit accepts an info-hash lookup. Replaces Transmission's numeric ids and the rqbit stub's "temp-id".

### D5. HTTP stack
`axum` + `tower-http` (trace, compression). Middleware order: host check → origin check (writes only) → auth (skips `health`, `auth/*`, and static UI) → routes. No CORS layer at all (same-origin only). Multipart via axum's `multipart` feature, body limit 10 MB for `.torrent` uploads.

### D6. Embedded UI
`rust-embed` over `apps/web/dist`. In debug builds rust-embed reads from disk (fast iteration); release builds embed. A `build.rs` in `torrentx-server` creates `apps/web/dist/index.html` with a "UI not built – run `pnpm build:web`" stub if missing, so `cargo build` never fails on a clean checkout. SPA fallback: unknown non-`/api/` paths → `index.html`.

### D7. Config
TOML via `serde` + `toml`; paths via `directories`. Shape:
```toml
[server]
bind = "127.0.0.1"
port = 9977
allowed_hosts = []
[auth]
enabled = false
username = ""
password_hash = ""        # argon2id PHC string
[engine]
kind = "rqbit"            # or "transmission"
[engine.rqbit]
download_dir = "~/Downloads/TorrentX"
[engine.transmission]
url = "http://127.0.0.1:9091/transmission/rpc"
username = ""
password = ""             # plaintext: needed to call RPC
```
Written atomically (temp file + rename) with mode 0600 on Unix since it can contain the Transmission password. rqbit's persistence/session state lives in `<data_dir>/torrentx/rqbit/`.

### D8. Auth
- Password → `argon2` (argon2id, random salt).
- Sessions: in-memory `HashMap<token, expiry>` (32 random bytes, hex; 30-day sliding expiry). Cookie `tx_session`, HttpOnly, SameSite=Strict, Path=/. Lost on restart → user logs in again (acceptable, see Non-Goals).
- Basic auth accepted on every protected route for scripts/curl.
- Enabling auth via PUT settings: the handler also mints a session and sets the cookie on the response so the current UI stays logged in.
- **Desktop auto-login:** the in-process server exposes `ServerHandle::issue_handoff_token()` (single-use, 60 s TTL, Rust-API only – no HTTP endpoint mints it). The desktop navigates the window to `/api/v1/auth/handoff?token=…`, which sets the session cookie and redirects to `/`. In attach mode (external server) the user logs in normally.

### D9. Browser attack protections
Host allowlist (loopback names when bound to loopback + `allowed_hosts`) prevents DNS rebinding; Origin must equal `http://{Host}` on POST/PUT/DELETE when present, which prevents CSRF from arbitrary sites even with auth off. SameSite=Strict cookies cover the auth-on case too. Mirrors what Transmission itself does (host whitelist + CSRF header).

### D10. Server library API
```rust
pub struct ServerOptions { config_path: PathBuf, bind_override: Option<IpAddr>, port_override: Option<u16> }
pub async fn start(opts) -> Result<ServerHandle, StartError>   // returns after the socket is bound
impl ServerHandle { fn addr(&self) -> SocketAddr; fn issue_handoff_token(&self) -> String; async fn shutdown(self) }
```
The binary: parse clap args → `start` → wait for SIGINT/SIGTERM → `shutdown` (with 10 s timeout). `StartError::AddrInUse` is distinct so the desktop can react.

### D11. Desktop shell
- Tauri latest 2.x with the `tray-icon` feature; plugins: `single-instance`, `opener`, `dialog`. `@tauri-apps/api` is only needed if the stub page uses it (it doesn't; it's static).
- Startup (in `setup`): read the config from the app-config dir → probe `GET http://127.0.0.1:<port>/api/v1/health` (500 ms timeout):
  - TorrentX answers → attach mode, no local server.
  - Connection refused → `torrentx_server::start` on Tauri's tokio runtime (`tauri::async_runtime`), keep `ServerHandle` in managed state.
  - Anything else / `AddrInUse` → dialog error naming the port.
- The main window is created programmatically with `WebviewUrl::External("http://127.0.0.1:<port>/")` (or the handoff URL). The remote origin gets **no** capabilities, so the page has no Tauri IPC access.
- Close requested → `prevent_close` + hide. Tray left-click toggles visibility; menu: Show, Open in Browser, Quit. Quit → `ServerHandle::shutdown().await` → `app.exit(0)`.
- `TORRENTX_UI_DEV_URL` env var (dev only) points the window at the Vite dev server for HMR.

### D12. Web UI data flow
`@torrentx/api-client` wraps `fetch` (same origin, `credentials: 'same-origin'`), throws a typed `ApiError { kind, message, status }`. Polling every 1.5 s via a small `usePoll` hook that pauses on `document.visibilityState === 'hidden'`. A 401 from any call flips an app-level `needsLogin` state. No state library; existing `useState` pattern stays.
Vite dev: `server.proxy['/api'] → http://127.0.0.1:9977` with the `Origin` header stripped in `proxyReq` (otherwise D9 rejects writes from `localhost:1420`).

### D13. Engine specifics
- **rqbit:** librqbit (latest at implementation) `Session` with persistence + fastresume enabled, output folder = `download_dir`. Add: magnet/URL via `AddTorrent::from_url`, bytes via `AddTorrent::from_bytes`; `AlreadyManaged` → `duplicate`. Stats → model: rates from live stats, `peers`/`seeds` from peer stats (seeds may be unknown → 0), `queued` unused.
- **Transmission:** port existing RPC code; `session_id: Mutex<Option<String>>`, retry once on 409; 401 → `engine_unavailable("authentication failed")`; `torrent-add` with `filename` (magnet/URL) or `metainfo` (base64 bytes); `torrent-duplicate` → `duplicate`; `error != 0` → status `error` with `errorString`; `eta` < 0 → null.

## Risks / Trade-offs

- [librqbit API churn between majors] → pin the exact version in `Cargo.toml`; all librqbit calls confined to `torrentx-rqbit`.
- [Hand-written TS types drift from Rust model] → one JSON fixture in `crates/torrentx-core/tests/fixtures/torrent.json` asserted by a Rust serde test **and** imported by an api-client type-check (`satisfies Torrent`).
- [Webview loading an http:// remote URL] → only loopback; the remote origin has no IPC capabilities; CSP stays off for the stub page only.
- [In-memory sessions] → restart logs users out; acceptable, documented.
- [In-process server dies with app] → by design (user choice); users who want 24/7 run the headless service and the app attaches to it.
- [Transmission password in plaintext config] → file mode 0600; documented.
- [Polling cost with many torrents] → 1.5 s interval, paused when tab hidden; SSE can be added later without API breakage (new endpoint).
- [Auth off + bind 0.0.0.0 exposes full control] → UI warning + server logs a `warn!` at startup; user's explicit choice.

## Migration Plan

1. Restructure (git mv) and get the empty workspace building before any feature work – one commit.
2. Land crates bottom-up: core → transmission → rqbit → server → web migration → desktop.
3. No user data exists yet (backend never worked), so no data migration. Rollback = revert commits.
4. Update `CLAUDE.md` in the final step.

## Open Questions

- macOS: hide the Dock icon (`ActivationPolicy::Accessory`) for a pure menu-bar feel, or keep it? Doesn't affect specs; default: keep Dock icon.
- Default port 9977 – fine unless it clashes with something the user runs.
