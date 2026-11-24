## Context

- `apps/web` (React 19, Tailwind 3, lucide-react) is a small UI over `/api/v1`; `vendor/torrent-client-magic-patterns`
  (React 18, mock data) is the target design. Component names already match (Header, TabBar, TorrentList, …).
- Engines are an enum (`torrentx-server/src/engine.rs`) over `RqbitEngine` (librqbit 9.0.1) and
  `TransmissionEngine` (RPC). The API today: list/get/add/pause/resume/remove, settings, health, auth.
- The UI must work identically in a browser and the desktop window without Tauri IPC (existing `web-ui` spec).
- Depends on `restructure-monorepo-headless-server` being archived (its specs are the base for our deltas).

## Goals / Non-Goals

**Goals:** pixel-faithful port of the vendor UI; every control wired to real behavior or honestly disabled
per engine; one settings model shared by server, UI and desktop; engine gaps filled server-side where feasible.

**Non-Goals:** porting the unused vendor `Sidebar`; a plugin/extension system; auto-installing updates
(notice + link only); implementing BitTorrent protocol features inside librqbit (super seeding, anonymous mode,
WebSocket trackers, HTTP/SOCKS4 proxy) — these are exposed as capabilities and stay disabled where no engine
provides them.

## Decisions

### D1. Port vendor components in place, split data from view
Copy each vendor component into `packages/ui/src/components` (D12), strip mock state, and feed it from hooks in
`packages/ui/src/lib` (`useTorrents`, `useDetails(id)`, `useStats`, `useTabs`, `useCapabilities`, `useSettings`).
Keep vendor markup/Tailwind classes; replace literal colors with theme tokens (D8). Existing `Modal`,
`RemoveDialog`, `Login`, `usePoll`, `format.ts` are kept and reused. Alternative (restyle current components)
rejected: the vendor file is the design source; porting keeps diffs against it reviewable.

### D2. Capability matrix is the single source of "does it work"
Each engine exposes `fn capabilities(&self) -> Capabilities` (static for rqbit; for Transmission derived from
`session-get` `rpc-version`/`version`). Server merges in features it implements itself (`via: "server"`).
The UI reads `/capabilities` once per engine change and gates controls. Engine methods for unsupported ops
return `EngineError::Unsupported` → HTTP 501 `unsupported`.

Planned matrix (verified against librqbit 9.0.1 `api.rs`/`session.rs` and Transmission RPC 17/18):

| Feature | rqbit | Transmission |
|---|---|---|
| fileSkip | engine (`update_only_files`) | engine (`files-unwanted`) |
| filePriority | — | engine (`priority-high/normal/low`) |
| addPreview | engine (`list_only`) | server: add paused → read files → remove if cancelled |
| verify | server: forget + re-add same metadata w/o fastresume (full check) | engine (`torrent-verify`) |
| relocate | server: pause, forget, move files, re-add with `output_folder` | engine (`torrent-set-location move`) |
| rename | server: display-name override in tabs/meta store (files untouched, noted) | engine (`torrent-rename-path`) |
| addTracker | — | engine (`trackerAdd`/`trackerList`) |
| trackerStatus | partial (URLs only; status null) | engine (`trackerStats`) |
| peerList / peerClient | engine (`api_peer_stats`) / — | engine (`peers`) |
| pieces | engine (`api_dump_haves`) | engine (`pieces` base64) |
| torrentFile | engine (stored metainfo bytes) | server: read `torrentFile` path if readable, else unsupported for that torrent |
| torrentPriority | — | engine (`bandwidthPriority`) |
| speedLimits | engine (session `ratelimits`) | engine (`speed-limit-*`) |
| maxConnectionsPerTorrent | — | engine (`peer-limit-per-torrent`) |
| listenPort / upnp | engine (listener opts, engine restart) | engine (`peer-port`, `port-forwarding-enabled`) |
| proxySocks5 | engine (`socks_proxy_url`, engine restart) | — (removed in Transmission) |
| proxyHttp / proxySocks4 | — | — |
| queue | server policy loop | engine (`download-queue-*`, `seed-queue-*`) |
| seedLimits | server policy loop | engine ratio (`seedRatioLimit`); seed time via server loop |
| moveCompleted | server policy loop (relocate) | engine (`incomplete-dir` inversion) |
| diskCache | — | engine (`cache-size-mb`) |
| dht | engine (`disable_dht`, engine restart) | engine (`dht-enabled`) |
| pex / lpd | — | engine (`pex-enabled`, `lpd-enabled`) |
| sequentialDownload | — | engine (`sequential_download`, Transmission ≥ 4.1) |
| osCache, superSeeding, anonymousMode, webSocketTrackers | — | — |

Rows marked "engine restart" restart only the engine (existing live-restart path), never the HTTP server.

### D3. Server-owned metadata store
New `crates/torrentx-server/src/store.rs`: one JSON file `state.json` next to the config holding tabs,
torrent→tab map, rqbit rename overrides, per-torrent server policy data (seeding start time, cumulative
up/down for rqbit), dismissed-notification ids. Written atomically (tmp + rename) under a `tokio::Mutex`.
Alternative (SQLite) rejected: tiny data, no queries.

### D4. Policy loop
A tokio task in the server ticks every 5 s: enforces queue limits (pause extras → report `queued` via store
flag), ratio/seed-time stop, move-completed. Only features whose capability is `via: "server"` are handled;
native ones are pushed to the engine as settings. Emits completion/added events into a broadcast channel
used by the desktop notifier (D7).

### D5. Settings schema v2 + migration
`Config` gains `network`, `downloads`, `advanced`, `preferences` sections with serde defaults; transmission
`url` becomes `host/port/path/https`. Loading a v1 file parses the old `url` into the new fields and rewrites
the file on next save. `PUT /settings` diffs old/new and calls `Engine::apply_settings(&Settings)`; engine
decides live-apply vs engine restart.

### D6. Stats via `sysinfo`
`sysinfo` (process CPU/mem, disks) sampled lazily on `/stats` with the previous sample cached for CPU delta.
Disk = the mount with the longest prefix of the default save path. Session totals: rqbit `api_session_stats`;
Transmission `session-stats`.

### D7. Desktop OS features
`tauri-plugin-autostart` (login item), `tauri-plugin-notification`. The desktop app, which owns the in-process
`ServerHandle`, subscribes to the server event channel (or polls `/api/v1/torrents` every 5 s when attached to
an external server) and emits native notifications. Settings changes reach the desktop via the same channel
(`SettingsChanged`) to toggle autostart. Start minimized: skip `window.show()` at launch. Quit confirmation:
tray Quit / `RunEvent::ExitRequested` checks for downloading torrents and shows a `tauri-plugin-dialog` confirm.
The web UI suppresses browser notifications when `window.__TAURI_INTERNALS__` exists (detection only, no IPC).

### D8. Themes and i18n without new deps
Theme = CSS variables on `<html data-theme>` (hacker/dark-blue/light) mapped in `tailwind.config` as
`colors.tx.*`; `useSystemTheme` uses `prefers-color-scheme`. i18n = `packages/ui/src/i18n/{en,fr,de,es,ru,zh}.json`
+ a 20-line `t(key)` context with English fallback; a unit check asserts all dictionaries share en's keys.
Alternative (react-i18next) rejected: one context + JSON covers it.

### D9. GeoIP for peer country
`maxminddb` crate reading DB-IP "IP to Country Lite" (CC BY 4.0) `.mmdb`, fetched by
`scripts/fetch-geoip.sh` into the build and embedded in release builds (~7 MB); debug builds load from disk if
present, else `country: null`. Attribution added to the About/Advanced section.

### D10. Terminal = thin command parser over `api`
Pure function `run(cmd, api) -> lines[]` in `packages/ui/src/lib/terminal.ts` with a small test; id arguments
accept any unique id prefix.

### D11. Reveal in file manager
Server calls `opener`-equivalent (`open` crate) on the torrent path, only when the TCP peer is loopback.
Headless servers without a desktop session return the opener error.

### D12. `packages/ui` holds the UI, `apps/web` is the shell
`@torrentx/ui` contains components, hooks, i18n dictionaries, theme CSS variables and a Tailwind preset; it
depends on `@torrentx/api-client`. It ships TypeScript source (`"exports": {".": "./src/index.ts"}`) with no
build step — Vite in `apps/web` compiles it. `apps/web` keeps `main.tsx`, `index.css`, `vite.config.ts` and a
`tailwind.config` that uses the preset and adds `../../packages/ui/src/**/*.{ts,tsx}` to `content`. Lint and
typecheck cover the package. Alternative (keep UI in `apps/web`) rejected by request: keeps the UI reusable
(e.g. a future standalone desktop bundle) and separates app wiring from components.

### D13. Frameless desktop window
`WebviewWindowBuilder` gets `.decorations(false)`, `.shadow(true)`, `.min_inner_size(900., 600.)`. The header
root carries `data-tauri-drag-region` (buttons/inputs excluded, as Tauri only drags from elements with the
attribute). `packages/ui/src/lib/window.ts` exposes `close/minimize/toggleMaximize`: when
`window.__TAURI_INTERNALS__` exists it dynamically imports `@tauri-apps/api/window`, otherwise no-ops — so
browsers never load Tauri code. Red calls `hide()` (matches existing close-to-tray). Because the window loads
the server's `http://127.0.0.1:<port>` origin, a capability file (`capabilities/window.json`) sets
`remote.urls` to `http://127.0.0.1:*` and `http://localhost:*` for window `main` and grants only
`core:window:allow-{hide,minimize,toggle-maximize,start-dragging,internal-toggle-maximize}`. Alternative
(`titleBarStyle: Overlay` keeping native macOS lights) rejected: duplicates the vendor dots and is macOS-only.

## Risks / Trade-offs

- [Remote origin gains IPC in the desktop window] → only window permissions granted; Host/Origin guard pins the
  origin to loopback; attaching to a foreign process is already refused.
- [Frameless windows lose native resize edges on some Linux WMs] → keep `resizable(true)`; document that
  window-manager resizing (Alt+drag) applies there.

- [rqbit verify/relocate via forget+re-add can lose tab/meta linkage] → keyed by info-hash, which is stable.
- [rqbit rename is display-only] → capability `note` says "display name only on rqbit".
- [Transmission preview for magnets needs metadata from peers; may hang] → 30 s timeout, then error; temp
  torrent always removed on cancel/timeout.
- [Policy loop vs user pause races] → store remembers "paused by policy" vs "paused by user"; policy never
  resumes user-paused torrents.
- [Binary size +7 MB from GeoIP] → acceptable; feature-flag `geoip` to drop it for minimal builds.
- [API breaking change for settings] → UI and server ship together (UI embedded); config migration covers files.
- [Six languages need translations] → ship machine-assisted dictionaries; missing keys fall back to English.

## Migration Plan

1. Archive `restructure-monorepo-headless-server`. 2. Land server/engine/API work behind the existing UI
(backward-compatible additions first, settings v2 + migration last). 3. Swap UI. 4. Desktop features.
Rollback: previous binary ignores unknown config sections only if they are optional — keep all new sections
`#[serde(default)]` and preserve a `config.v1.bak` on first migration.
