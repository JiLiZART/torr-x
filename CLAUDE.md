# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TorrentX** is a torrent client: a Rust server (engine + HTTP API + embedded web UI) that runs either
headless (`torrentx-server`, e.g. as a Linux systemd service) or in-process inside a Tauri 2 tray app.
The React UI talks only to the HTTP API (`/api/v1`), never to Tauri IPC, so the same build works in a
browser and in the desktop window.

### Tech Stack
- **Frontend**: React 19 + TypeScript + Tailwind 3 + Vite 7 (`apps/web`)
- **Desktop**: Tauri 2 (`apps/desktop`), plugins: single-instance, opener, dialog; `tray-icon` feature
- **Server**: axum 0.8, rust-embed (UI embedded in release builds), argon2 auth
- **Engines**: `librqbit` 9 (embedded) or Transmission RPC (reqwest)
- **Workspaces**: pnpm workspace + single Cargo workspace (root lockfiles)

## Layout

```
apps/web                    React UI (Vite). Talks to /api/v1 via @torrentx/api-client
apps/desktop/src            static stub page (Tauri frontendDist; not used by the main window)
apps/desktop/src-tauri      crate torrentx-desktop: tray, window, in-process server / attach
crates/torrentx-core        shared model (Torrent, TorrentDetails, Status, EngineError), check_uri/parse_id
crates/torrentx-rqbit       RqbitEngine (librqbit Session with JSON persistence + fastresume)
crates/torrentx-transmission TransmissionEngine (RPC, 409 session-id retry, status mapping)
crates/torrentx-server      lib: config, Engine enum, api router, auth + guards, ui; bin: torrentx-server
packages/api-client         @torrentx/api-client: TS types + fetch wrapper (mirrors Rust model)
packaging/systemd           torrentx.service
docs/linux-service.md       service install guide
openspec/                   specs and change proposals
```

## Key Design Points

- **Engine dispatch** is an enum (`crates/torrentx-server/src/engine.rs`), not a trait object. Both engine
  crates expose the same inherent async methods and return `torrentx_core` types.
- **Torrent id** = lowercase hex info-hash everywhere.
- **Engine slot** (`AppState.engine`) is `Result<Arc<Engine>, String>`; Err → API `engine_unavailable` (503).
  Settings changes to the engine restart it live; bind/port changes return `restartRequired`.
- **Security**: `auth::guard` enforces a Host allowlist when bound to loopback (anti DNS-rebinding) and rejects
  POST/PUT/DELETE whose `Origin` ≠ Host (anti CSRF), even with auth off. No CORS headers. Auth (off by default)
  = session cookie (`tx_session`, in-memory) or HTTP Basic. Passwords never returned by `GET /settings`.
- **Desktop**: on launch probes `GET /api/v1/health` on the configured port → attach if TorrentX, else start
  the server in-process (`torrentx_server::start`); foreign process → error dialog. With auth on, the window is
  logged in via a one-time `ServerHandle::issue_handoff_token()` → `/api/v1/auth/handoff`. Closing the window
  hides it; Quit/Cmd+Q shuts the server down gracefully.
- **UI embedding**: `crates/torrentx-server/build.rs` writes a stub `apps/web/dist/index.html` if missing so
  `cargo build` always works; run `pnpm build:web` first for the real UI. Debug builds read dist from disk.
- **Type drift guard**: `crates/torrentx-core/tests/fixtures/torrent.json` is checked by a Rust serde test and by
  `packages/api-client/src/fixture.check.ts`. Update both sides when the model changes.

## Commands

```bash
pnpm install
pnpm dev:server          # cargo run -p torrentx-server (127.0.0.1:9977)
pnpm dev:web             # Vite on :1420, proxies /api → TORRENTX_SERVER (default 127.0.0.1:9977)
pnpm dev:desktop         # tauri dev (TORRENTX_UI_DEV_URL=http://localhost:1420 for HMR in the window)
pnpm build:web | build:server | build:desktop
pnpm lint                # ESLint over apps/web + packages, --max-warnings 0
pnpm typecheck
cargo test --workspace   # unit + API tests (tower oneshot)
cargo test -p torrentx-rqbit -- --ignored          # network tests (magnet lifecycle, persistence)
TORRENTX_TEST_TRANSMISSION=http://127.0.0.1:9091/transmission/rpc \
  cargo test -p torrentx-transmission -- --ignored # needs a transmission-daemon
```

## Conventions

- Keep the terminal look: green on black, monospace, minimal shadows.
- UI state: local React hooks; polling via `usePoll` (pauses when the tab is hidden).
- Lint before commits: `pnpm lint`.
