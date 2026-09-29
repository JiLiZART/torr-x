## 1. Workspace restructure

- [x] 1.1 `git mv` frontend (`src/`, `index.html`, `vite.config.ts`, `tailwind.config.js`, `postcss.config.*`, `tsconfig*.json`, `.eslintrc.cjs`, `public/`) into `apps/web/` with its own `package.json` (`@torrentx/web`); verify `pnpm --filter @torrentx/web build` produces `apps/web/dist/index.html`
- [x] 1.2 `git mv src-tauri apps/desktop/src-tauri`, rename crate to `torrentx-desktop`, add `apps/desktop/package.json` (`@torrentx/desktop`) with `@tauri-apps/cli`, and fix `tauri.conf.json` paths; verify `ls` shows no root `src/` or `src-tauri/`
- [x] 1.3 Add root `Cargo.toml` `[workspace]` (members `crates/*`, `apps/desktop/src-tauri`, shared `[workspace.dependencies]` and release profile) and root `pnpm-workspace.yaml` (`apps/*`, `packages/*`); verify `pnpm install` and `cargo metadata` succeed with a single root lockfile each
- [x] 1.4 Add root scripts `dev:web`, `dev:server`, `dev:desktop`, `build:web`, `build:server`, `build:desktop`, `lint`; verify `pnpm lint` runs ESLint across the workspace and exits 0

## 2. torrentx-core

- [x] 2.1 Create `crates/torrentx-core` with `Torrent`, `TorrentDetails`, `FileInfo`, `Status` (serde camelCase / lowercase enum), `AddSource { Uri(String), Bytes(Vec<u8>) }`, and `EngineError { NotFound, InvalidInput, Duplicate, Unavailable }` (thiserror, each with message); verify `cargo build -p torrentx-core`
- [x] 2.2 Add fixture `tests/fixtures/torrent.json` and a serde round-trip test for the model; verify `cargo test -p torrentx-core` passes

## 3. torrentx-transmission

- [x] 3.1 Port RPC client into `crates/torrentx-transmission` on current `reqwest`: `session_id: Mutex<Option<String>>`, single retry on 409, 401 → `Unavailable("authentication failed")`, connect errors → `Unavailable`; verify `cargo build -p torrentx-transmission`
- [x] 3.2 Implement `list`, `get` (with `files`/`fileStats`), `add` (`filename` / base64 `metainfo`, `torrent-duplicate` → `Duplicate`), `pause`, `resume`, `remove(delete_data)`, all addressed by `hashString`; verify against a local `transmission-daemon` by adding a public magnet (e.g. a Debian ISO) and exercising each op
- [x] 3.3 Implement the corrected status mapping (0 stopped→paused, 1/2→checking, 3/5→queued, 4→downloading, 6→seeding, error≠0→error) and `eta<0`→None as a pure function; verify with a unit test covering every status code

## 4. torrentx-rqbit

- [x] 4.1 Create `crates/torrentx-rqbit` pinned to latest librqbit; `RqbitEngine::start(download_dir, state_dir)` with persistence + fastresume; verify `cargo build -p torrentx-rqbit`
- [x] 4.2 Implement `list`, `get` (files), `add` (URI/bytes, `AlreadyManaged` → `Duplicate`, parse errors → `InvalidInput`), `pause`, `resume`, `remove(delete_data)`, `shutdown`, mapping stats to the core model with info-hash ids; verify with an `#[ignore]` integration test that adds a public magnet, pauses/resumes, and removes with data
- [x] 4.3 Verify persistence manually: add two torrents, pause one, restart the process, confirm both return and the paused one is still `paused`

## 5. torrentx-server: config and engine

- [x] 5.1 Create `crates/torrentx-server` (lib + `torrentx-server` bin) with `Config` (D7 shape), defaults, load/validate, and atomic 0600 write; verify unit tests: missing file → defaults written; invalid TOML → error naming the file and file untouched
- [x] 5.2 Implement `Engine` enum dispatch (D2) and `AppState` with a hot-swappable `EngineSlot` (D3); engine start failure stores `Err(msg)`; verify `cargo build -p torrentx-server`
- [x] 5.3 Implement `ServerOptions`/`start`/`ServerHandle { addr, issue_handoff_token, shutdown }` (D10) with `StartError::AddrInUse`; verify a test that binds a port and asserts a second `start` on it returns `AddrInUse`

## 6. torrentx-server: HTTP API

- [x] 6.1 Router under `/api/v1`: health, torrents CRUD + pause/resume, JSON and multipart add (10 MB limit), error → status/body mapping per http-api spec; verify with `tower::ServiceExt::oneshot` tests on health, error shape (404 `not_found`), and 503 when the engine slot is `Err`
- [x] 6.2 Settings GET/PUT: redact passwords, validate, persist, live engine swap, `restartRequired` on bind/port change; verify tests: password absent from GET; invalid transmission URL → 400 and file unchanged; port change → `restartRequired: true`
- [x] 6.3 Auth (D8): argon2 hashing, login/logout, in-memory sessions, cookie flags, Basic auth, handoff endpoint, and auto-session on enabling auth; verify tests: 401 without creds, cookie login works, wrong password → 401 no cookie, Basic works, handoff token single-use
- [x] 6.4 Host allowlist and Origin check middleware (D9); verify tests: `Host: evil.example` → 403 on loopback bind; POST with foreign `Origin` → 403; same-origin POST → OK; no `Access-Control-*` headers in responses
- [x] 6.5 Embedded UI via rust-embed + `build.rs` stub + SPA fallback (D6); verify `GET /` returns index.html, `GET /some/route` returns index.html, an asset returns the correct content-type, and `cargo build` works on a clean checkout without `apps/web/dist`

## 7. torrentx-server: binary and service

- [x] 7.1 clap CLI (`--config`, `--bind`, `--port`), tracing logs, a `warn!` when bind is non-loopback with auth off, SIGINT/SIGTERM → shutdown with 10 s timeout; verify `torrentx-server --port 8080` serves on 8080 without editing config, and Ctrl-C exits 0
- [x] 7.2 Add `packaging/systemd/torrentx.service` (dedicated user, `Restart=on-failure`, `--config /etc/torrentx/config.toml`) and `docs/linux-service.md` install steps; verify with `systemd-analyze verify packaging/systemd/torrentx.service` on Linux
- [x] 7.3 Release single-binary check: `pnpm build:server` (web build → `cargo build --release -p torrentx-server`), copy only the binary to a temp dir, run it, and confirm `http://localhost:9977/` serves the UI

## 8. @torrentx/api-client

- [x] 8.1 Create `packages/api-client` with TS types mirroring the core model + settings, `ApiError`, and functions for every endpoint (same-origin fetch, `credentials: 'same-origin'`); verify `pnpm --filter @torrentx/api-client typecheck` including `fixture satisfies Torrent` against `crates/torrentx-core/tests/fixtures/torrent.json`

## 9. Web UI migration

- [x] 9.1 Delete `apps/web/src/lib/torrent-api.ts`, switch components to `@torrentx/api-client`, add `usePoll` (1.5 s, paused when hidden) and the Vite `/api` proxy with the Origin header stripped (D12); verify `pnpm dev:server` + `pnpm dev:web` shows live progress of a downloading torrent
- [x] 9.2 Add torrent via magnet/URL input and `.torrent` file pick/drop; pause/resume/remove with in-page confirmation for delete-data; details panel with file list; API error messages shown; verify each action manually in a browser
- [x] 9.3 `engine_unavailable` banner linking to settings; verify by configuring an unreachable Transmission URL
- [x] 9.4 Settings screen (server, allowed hosts, auth, engine options), `restartRequired` notice, warning for non-loopback bind with auth off; verify switching rqbit→transmission live updates `health.engine`
- [x] 9.5 Login screen + logout, global 401 handling; verify enabling auth keeps the current tab logged in, and a fresh private window gets the login form
- [x] 9.6 Verify `pnpm lint` and `pnpm build:web` pass with no Tauri imports left in `apps/web` (`grep -r "@tauri-apps" apps/web/src` returns nothing)

## 10. Desktop app

- [x] 10.1 Upgrade to latest Tauri 2.x (`tauri` with `tray-icon`, `tauri-build`, `@tauri-apps/cli`) and add `single-instance`, `opener`, `dialog` plugins; replace frontend with the static stub page `apps/desktop/src/index.html`; verify `pnpm build:desktop` succeeds
- [x] 10.2 Startup flow (D11): load config from app-config dir, health probe, attach vs in-process `start`, error dialog on foreign process / `AddrInUse`; verify: (a) nothing running → in-process server, (b) `torrentx-server` already running → attach and no second engine, (c) `nc -l 9977` running → dialog naming the port
- [x] 10.3 Main window with `WebviewUrl::External` to the server (handoff URL when auth is on and in-process), no capabilities for the remote origin, `TORRENTX_UI_DEV_URL` override; verify window shows the UI and, with auth enabled, no login form appears
- [ ] 10.4 Tray: left-click toggle, menu Show / Open in Browser / Quit; close → hide; Quit → `shutdown().await` then exit; verify each behavior manually and that the port is free after Quit (`lsof -i :9977` empty)
- [x] 10.5 Single-instance: second launch focuses the existing window; verify by launching twice

## 11. End-to-end and docs

- [x] 11.1 Cross-surface check: with the desktop app running, add a torrent from a browser tab at `localhost:9977` and confirm it appears in the desktop window within 2 s
- [x] 11.2 Rewrite `CLAUDE.md` architecture/commands sections and add a README section for desktop vs headless usage; verify every command listed in docs runs
