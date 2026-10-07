# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TorrentX** is a torrent client: a Rust server (engine + HTTP API + embedded web UI) that runs either
headless (`torrentx-server`, e.g. as a Linux systemd service) or in-process inside a Tauri 2 tray app.
The React UI talks only to the HTTP API (`/api/v1`) for data, so the same build works in a browser and in the
desktop window. The only Tauri calls are window controls in the frameless desktop window (see Desktop below).

### Tech Stack
- **Frontend**: React 19 + TypeScript + Tailwind 3 + Vite 7 (`packages/ui` components, `apps/web` shell)
- **Desktop**: Tauri 2 (`apps/desktop`), plugins: single-instance, opener, dialog, autostart, notification;
  `tray-icon` feature; frameless window
- **Server**: axum 0.8, rust-embed (UI embedded in release builds), argon2 auth, sysinfo (stats),
  maxminddb (peer country, DB-IP Lite)
- **Engines**: `librqbit` 9 (embedded) or Transmission RPC (reqwest)
- **Workspaces**: pnpm workspace + single Cargo workspace (root lockfiles)

## Layout

```
apps/web                    Vite shell: main.tsx + Tailwind config rendering @torrentx/ui
apps/desktop/src            static stub page (Tauri frontendDist; not used by the main window)
apps/desktop/src-tauri      crate torrentx-desktop: tray, window, in-process server / attach
crates/torrentx-core        shared model (Torrent, TorrentDetails, Peer, Preview, AddOptions, Capabilities,
                            engine settings sections, EngineError incl. Unsupported), check_uri/parse_id
crates/torrentx-rqbit       RqbitEngine (librqbit Session with JSON persistence + fastresume)
crates/torrentx-transmission TransmissionEngine (RPC, 409 session-id retry, status mapping)
crates/torrentx-server      lib: config (+v1 migration), Engine enum, api router, auth + guards, store
                            (state.json: tabs, renames, policy), policy loop, stats, geoip, ui; bin: torrentx-server
packages/api-client         @torrentx/api-client: TS types + fetch wrapper (mirrors Rust model)
packages/ui                 @torrentx/ui: ported vendor UI (components, hooks, i18n, themes, Tailwind preset)
vendor/torrent-client-magic-patterns  original design mock (reference only, not built)
scripts/fetch-geoip.sh      downloads the DB-IP country DB embedded by `--features geoip`
packaging/systemd           torrentx.service
docs/linux-service.md       service install guide
openspec/                   specs and change proposals
```

## Key Design Points

- **Engine dispatch** is an enum (`crates/torrentx-server/src/engine.rs`), not a trait object. Both engine
  crates expose the same inherent async methods and return `torrentx_core` types.
- **Capabilities** (`GET /capabilities`): each engine reports which optional features it supports and
  whether natively (`via: engine`) or through TorrentX (`via: server`). The UI disables unsupported
  controls with a "not supported by <engine>" hint; engines return `unsupported` (HTTP 501). Unknown model
  fields are `null`, never invented.
- **Server-side features**: `policy.rs` ticks every 5 s (queue limits, seeding limits, move-completed for
  `via: server`, plus added/completed `ServerEvent`s); decisions are a pure `plan()` with unit tests.
  rqbit verify/relocate = forget + re-add; rqbit rename = display-name override in `state.json`.
- **Torrent id** = lowercase hex info-hash everywhere.
- **Engine slot** (`AppState.engine`) is `Result<Arc<Engine>, String>`; Err → API `engine_unavailable` (503).
  Settings changes to the engine restart it live; bind/port changes return `restartRequired`.
- **Security**: `auth::guard` enforces a Host allowlist when bound to loopback (anti DNS-rebinding) and rejects
  POST/PUT/DELETE whose `Origin` ≠ Host (anti CSRF), even with auth off. No CORS headers. Auth (off by default)
  = session cookie (`tx_session`, in-memory) or HTTP Basic. Passwords never returned by `GET /settings`.
- **Desktop**: frameless window (`decorations(false)`); the UI header dots render and call `@tauri-apps/api/window`
  only when `window.__TAURI_INTERNALS__` exists, and `capabilities/window.json` grants just window ops (plus
  is-maximized/fullscreen and resize events) to the loopback server origin. Rounded corners: the window is
  transparent on macOS/Linux (`macos-private-api` feature, `macOSPrivateApi`), `initDesktopChrome()` sets
  `html[data-desktop]` / `[data-maximized]` and `apps/web/src/index.css` rounds `#root`; Windows 11 rounds natively. Autostart, start minimized, quit confirmation and native notifications follow
  `preferences` via `ServerHandle::info()` events (in-process) or polling (attached). On launch it probes `GET /api/v1/health` on the configured port → attach if TorrentX, else start
  the server in-process (`torrentx_server::start`); foreign process → error dialog. With auth on, the window is
  logged in via a one-time `ServerHandle::issue_handoff_token()` → `/api/v1/auth/handoff`. Closing the window
  hides it; Quit/Cmd+Q shuts the server down gracefully.
- **UI embedding**: `crates/torrentx-server/build.rs` writes a stub `apps/web/dist/index.html` if missing so
  `cargo build` always works; run `pnpm build:web` first for the real UI. Debug builds read dist from disk.
- **Type drift guard**: `crates/torrentx-core/tests/fixtures/torrent.json` is checked by a Rust serde test and by
  `packages/api-client/src/fixture.check.ts`. Update both sides when the model changes.
- **i18n**: `packages/ui/src/i18n/{en,fr,de,es,ru,zh}.json`; `pnpm lint` fails when keys differ from `en.json`.

## Commands

```bash
pnpm install
pnpm dev:server          # cargo run -p torrentx-server (127.0.0.1:9977)
pnpm dev:web             # Vite on :1420, proxies /api → TORRENTX_SERVER (default 127.0.0.1:9977)
pnpm dev:desktop         # tauri dev (TORRENTX_UI_DEV_URL=http://localhost:1420 for HMR in the window)
pnpm build:web | build:server | build:desktop   # server/desktop builds fetch + embed the GeoIP DB
pnpm lint                # i18n key check + ESLint over apps/web + packages, --max-warnings 0
pnpm typecheck
pnpm test                # node --test for packages/ui pure logic (terminal parser)
cargo test --workspace   # unit + API tests (tower oneshot)
cargo test -p torrentx-rqbit -- --ignored          # network tests (magnet lifecycle, persistence)
TORRENTX_TEST_TRANSMISSION=http://127.0.0.1:9091/transmission/rpc \
  cargo test -p torrentx-transmission -- --ignored # needs a transmission-daemon
```

## Conventions

- Keep the terminal look: green on black, monospace, minimal shadows.
- UI state: local React hooks; polling via `usePoll` (pauses when the tab is hidden).
- Lint before commits: `pnpm lint`.
- TS: double quotes, semicolons, named exports (`export function Foo`), component props as `interface FooProps`,
  event handlers `handleX`/`onX`. Types come from `@torrentx/api-client` — never redeclare model types in `packages/ui`.
- UI strings go through `t()`; colors use theme tokens (`tx-*`), not literal green/gray classes.
- Errors: API calls are awaited in `try/catch` and routed to one `handleError` in `packages/ui/src/components/App.tsx`.
- Tests: Rust `cargo test --workspace` (API tests via tower `oneshot`); JS only for pure logic via
  `node --experimental-strip-types --test` (no framework).

## Known Gaps

- No list virtualization — fine for hundreds of torrents, revisit at thousands.
- No CI pipeline.
- Features no engine offers stay disabled: OS cache, super seeding, anonymous mode, WebSocket trackers,
  HTTP/SOCKS4 proxy.
- Attached desktop app (server started elsewhere) cannot notify when auth is on (no login for polling).
