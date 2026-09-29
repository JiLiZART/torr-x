## Why

TorrentX today is a single Tauri template with a non-compiling, stubbed backend (sync `TorrentBackend` trait vs `async` impls, commented-out commands) and a frontend still importing the Tauri v1 API path (`@tauri-apps/api/tauri`). It can only ever run as a desktop window. Users also want to run it as a headless service on a Linux box and manage it from a browser, so the torrent engine has to live in a server that both the desktop app and a plain browser can talk to.

## What Changes

- **BREAKING** Restructure the repo into a monorepo:
  - `apps/desktop` – Tauri shell (tray + window), `apps/web` – React UI (Vite)
  - `crates/*` – Rust workspace crates (core types, rqbit engine, transmission engine, server)
  - `packages/*` – npm packages (typed HTTP API client)
  - Root `pnpm-workspace.yaml` + root Cargo workspace; `src/` and `src-tauri/` are removed/moved.
- Upgrade Tauri and plugins to the latest 2.x release; drop the v1 `invoke` import. The UI no longer uses Tauri IPC at all.
- Implement two torrent engines as crates: embedded **rqbit** (librqbit, latest) and **Transmission** RPC client. One engine is active per server, chosen in settings.
- New **headless server** binary `torrentx-server`: runs the engine, exposes a versioned JSON HTTP API, and serves the built web UI from the same origin (`http://127.0.0.1:9977/` by default). Ships with a systemd unit for Linux.
- Server settings (bind address, port, auth, engine + engine options) are persisted to a TOML config file and editable from the UI. Default: bind `127.0.0.1`, **no auth**. User can enable username/password auth in settings.
- Localhost protections even without auth: Host-header allowlist (anti DNS-rebinding) and cross-origin write protection (anti CSRF), so arbitrary websites cannot drive the local API.
- **Desktop app** runs the server **in-process** on startup, shows a tray icon; clicking it toggles a window that loads the server's web UI from `localhost`. The same UI is reachable from any browser at `localhost:PORT`. If a TorrentX server is already listening on the configured port (e.g. the system service), the app attaches to it instead of starting its own.
- Web UI is migrated from IPC to the HTTP API via the shared API client, gains a settings screen and a login screen (shown only when auth is enabled).

## Capabilities

### New Capabilities
- `workspace-layout`: monorepo structure (apps/crates/packages), workspace tooling, and root build/dev/lint commands.
- `torrent-engine`: engine-agnostic torrent model and operations (list, details, add, pause, resume, remove), implemented by the rqbit and Transmission engines.
- `http-api`: versioned JSON HTTP API over the active engine, including settings endpoints, optional auth, and localhost request protections.
- `headless-server`: `torrentx-server` binary – config file, CLI overrides, static web UI hosting, graceful shutdown, systemd service.
- `desktop-app`: Tauri 2 (latest) app with in-process server, attach-to-existing behavior, tray icon, and a window showing the local web UI.
- `web-ui`: browser UI served by the server – torrent list/details/actions, settings, and login, talking only to the HTTP API.

### Modified Capabilities
<!-- none: no existing specs under openspec/specs/ -->

## Impact

- **Code**: everything under `src/` moves to `apps/web/src`; `src-tauri/` becomes `apps/desktop/src-tauri`; `src-tauri/src/backend/*` is rewritten into `crates/`. `src/lib/torrent-api.ts` is replaced by `packages/api-client`.
- **Dependencies (Rust)**: add `axum`, `tower-http`, `rust-embed`, `clap`, `toml`, `argon2`, `tracing`; bump `reqwest` 0.11 → current, `librqbit` → latest; add `tauri` `tray-icon` feature and `tauri-plugin-single-instance`.
- **Dependencies (npm)**: pnpm workspaces; `@tauri-apps/*` bumped to latest 2.x and only used in `apps/desktop`.
- **APIs**: Tauri IPC commands (never wired up) are dropped in favor of HTTP `/api/v1/*`.
- **Ops**: new systemd unit + default config path `/etc/torrentx/config.toml` for Linux service installs.
- **Docs**: `CLAUDE.md` layout and command sections must be rewritten.
- **Out of scope**: multi-user accounts, HTTPS termination (use a reverse proxy), running both engines at once, packaging (.deb/.rpm), CI.
