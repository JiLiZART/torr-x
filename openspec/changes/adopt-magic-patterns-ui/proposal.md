## Why

`vendor/torrent-client-magic-patterns` is the intended TorrentX UI: tabbed torrent list, rich details panel
(graphs, piece map, trackers, peers, file tree), add-torrent preview with file selection, a CLI terminal and a
six-section settings screen. Today it is a static mock (hard-coded data, `console.log` actions), while
`apps/web` is a minimal UI on the real API. We want the vendor UI as the product UI, with every control doing
something real — including OS-level features — on top of the existing server/engine architecture.

## What Changes

- Port the vendor components (React 19, same terminal look, same layout), driven only by `/api/v1`, into a new
  workspace package `packages/ui` (`@torrentx/ui`); `apps/web` becomes a thin shell (entry, providers, Vite
  build) that renders it.
- **Frameless desktop window**: no native title bar; the vendor header's traffic-light dots become real window
  controls (red = close/hide to tray, yellow = minimize, green = maximize) and the header is the drag area. In a
  plain browser the dots stay decorative. The unused vendor `Sidebar` is not ported; its storage gauge is served by
  the status bar's disk-free readout.
- **Tabs**: built-in All / Downloading / Completed plus user tabs (create, rename by double-click, delete,
  drag a torrent onto a tab, "Move to tab" menu). Tabs and membership are stored by the server.
- **List**: 8 sortable columns, client-side search, select-to-open details, ASCII empty state, header and
  status-bar global rates.
- **Row menu**: pause, resume, remove, remove + erase data, show in file manager, move to tab, move data,
  rename, save `.torrent` file, copy magnet link, verify (force recheck).
- **Details panel**: General (info rows, live speed graph, piece map, technical details incl. ratio,
  uploaded, availability, wasted, creator, comment, created date), Trackers (list + add tracker), Peers,
  Seeds, Files (tree, expand/collapse all, per-file priority High/Normal/Low, skip file).
- **Add torrent**: URL / file / magnet tabs, metadata preview (name, size, hash, pieces, trackers, comment)
  with file-tree selection, save path, create subfolder, start immediately, priority.
- **Terminal**: real commands against the API (`help`, `list`, `status`, `add`, `pause`, `resume`, `remove`,
  `clear`, `exit`).
- **Settings** (all persisted by the server and applied live unless noted):
  - General: start with system, start minimized, confirm quit while downloading, check for updates,
    interface language (en/fr/de/es/ru/zh).
  - Network: max connections per torrent, global up/down limits, listen port, UPnP/NAT-PMP, proxy.
  - Downloads: default save path, subfolder, move completed to, max active downloads/torrents, start
    automatically, default priority, seed automatically, min ratio, min seeding time.
  - Remote: Transmission host/port/auth (reshapes today's RPC URL fields) plus connection test.
  - Appearance: theme (Hacker / Dark Blue / Light), use system theme, show speed graph, show piece map,
    date format, desktop notifications (on complete, on add), completion sound.
  - Advanced: disk cache size, OS cache, super seeding, DHT, PeX, LPD, anonymous mode, sequential
    download, WebSocket trackers.
  - Existing server/auth/engine settings stay (moved into the new sections).
- **Status bar**: down/up rate, session ratio, free space of the download dir, server CPU % and memory,
  torrent / active counts.
- **Engine capabilities**: the API reports per-engine support for every optional feature; the UI disables
  unsupported controls with a "not supported by <engine>" hint instead of faking them. Where an engine lacks a
  feature but the server can provide it (queueing, ratio/seed-time stop, move-completed, relocate data on
  rqbit), the server implements it.
- **Desktop**: autostart, start minimized, quit confirmation, native notifications, read from server settings.
- **BREAKING (API)**: `Torrent`/`TorrentDetails` gain fields; `Settings` is restructured into sections and
  Transmission `url` is replaced by `host`/`port`/`path`/`https` (old config files are migrated on load).

## Capabilities

### New Capabilities
- `torrent-tabs`: server-stored user tabs and torrent-to-tab membership.
- `engine-capabilities`: per-engine feature matrix exposed by the API and honored by the UI.
- `app-preferences`: UI/OS-level preferences (language, theme, date format, notifications, autostart, updates)
  and their effect in browser and desktop.
- `system-stats`: session totals, disk free space and server process CPU/memory.

### Modified Capabilities
- `web-ui`: list, actions, details, add flow, settings screen and terminal are redefined by the vendor UI;
  the no-IPC rule is narrowed to data access, allowing window controls inside the desktop window.
- `http-api`: new torrent actions/details endpoints, restructured settings, tabs, stats, capabilities.
- `torrent-engine`: extended model (trackers, peers, pieces, file priority/wanted, ratio) and operations
  (verify, relocate, rename, add-preview, limits, queue/seeding policy).
- `desktop-app`: frameless window, autostart, start minimized, quit confirmation, native notifications.

These capabilities are introduced by `restructure-monorepo-headless-server`, which must be archived first so
the deltas apply to `openspec/specs/`.

## Impact

- New `packages/ui` (components, hooks, i18n, themes, Tailwind preset); `apps/web/src/**` reduced to a shell.
  New deps: `@tauri-apps/api` (window module only, lazily loaded in Tauri); i18n via static JSON dictionaries.
- `packages/api-client` types + methods; `crates/torrentx-core/tests/fixtures/torrent.json` and its TS check.
- `crates/torrentx-core` model; `crates/torrentx-rqbit`, `crates/torrentx-transmission` new methods;
  `crates/torrentx-server` routes, config schema + migration, policy task, stats (`sysinfo`), GeoIP
  (`maxminddb` + DB-IP Lite country DB), tabs store.
- `apps/desktop/src-tauri`: frameless window + window-control capability for the server origin;
  `tauri-plugin-autostart`, `tauri-plugin-notification`; quit flow.
- `vendor/torrent-client-magic-patterns` stays as design reference (not built).
