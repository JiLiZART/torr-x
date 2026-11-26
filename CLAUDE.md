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
                            (state.json v3: saved-query tabs, tags, renames, policy; migrates v2 membership
                            tabs), policy loop, stats, geoip, ui; bin: torrentx-server
packages/api-client         @torrentx/api-client: TS types + fetch wrapper (mirrors Rust model)
packages/query              @torrentx/query: the query language, pure TS with no runtime deps (parse, evaluate,
                            compare, format, chips, complete, ParseError)
packages/ui                 @torrentx/ui: shell (Sidebar, TopBar, FilterBar, StatusBar), list, dialogs, hooks,
                            Spotlight palette + add flow, command registry/keymap, i18n, theme tokens, Tailwind preset
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
- **One query language** (`packages/query`): `field:value` (or the prefix form `:field value`), `!`, `> < >= <=`, `a..b`, quoted phrases, `*`, implicit
  AND, `AND`/`OR`, one level of `( )`, and `sort:` as a predicate. Tabs, the lens, the filter builder and column
  headers all produce query text; nothing else filters or orders the list. Parse errors carry
  `{message, column, length, suggestion}`. `done:` parses but matches nothing (no source in the model).
- **Tabs are saved queries**: `{id, name, query, order, pinned, group}` in `state.json`, with `GRAMMAR_VERSION`. The
  server stores query text verbatim and never parses it; an unparseable tab shows an error badge and lists nothing.
  Built-in tabs (All, Downloading, Active, Seeding, Stalled) are seeded once; only `all` cannot be deleted. An empty
  `name` means "named by its query". Sidebar sections are derived in `lib/lens.ts` `sections()`: PINNED = `pinned`,
  AD-HOC = unnamed and ungrouped, SMART TABS = the rest.
- **Tags** replace tab membership: `Torrent.tags` (trimmed, lowercase, unique; at most 32 of 64 chars), set with
  `PUT /torrents/{id}/tags`, filled by the server in `decorate`. `Torrent.category` (one, optional, case kept) works the same
  via `PUT /torrents/{id}/category` `{category}`. Both are edited in `TagPicker` (row ⋯ menu, tags cell, hero tag line, ⌘L). `Torrent.tracker` is the first tracker's host,
  filled by the engines.
- **Lens**: per-tab, in-memory query ANDed onto the tab query (`App.tsx` + `lib/lens.ts`). The filter bar shows the
  tab query's chips first; editing them sets `Lens.scope` (an edited copy, never written to the tab). On a tab the user made (not
  `BUILT_IN_TABS`), chip, builder and sort edits rewrite the tab query instead, ⌘Z restores it, and "Save as tab" is hidden. Switching tabs clears it
  and keeps a session snapshot behind the `restore lens` pill. On built-in tabs "Save as tab" is the only write path to the sidebar.
- **Addresses**: `#/tab/<id>` and `#/torrent/<id>/<section>` (`lib/route.ts`); browser back/forward move between
  views; an address never carries a lens; a stale tab or torrent address opens a tab with a notice.
- **Detail page** (`components/detail/`): opened with Enter or a plain click (⌘-click / ⇧-click select). The list and
  its filter bar stay mounted but hidden, so ⌘[ / the breadcrumb return to the same scroll and lens. Sections
  Overview, Files, Peers, Trackers, Web seeds, Pieces each have a mini filter bar in the same query language
  with their own scope (`FILE_SCOPE`, `PEER_SCOPE`, `TRACKER_SCOPE`, `WEBSEED_SCOPE` in `packages/query`; rows
  built in `lib/detail.ts`); a section lens is in memory and cleared when the section changes. Files defaults to a folder tree (`fileTree` in `lib/detail.ts`, icons by `fileKind`) and offers a
  media view when `lib/media.ts` finds two or more episodes of one show; titles and quality come only from file
  names. Detail endpoints: `POST /torrents/{id}/reannounce`, `/web-seeds`, `/files/{index}/open|reveal`
  (loopback only, like reveal); capability keys `reannounce`, `webSeeds`, `addWebSeed`, `openFile`, `stream`.
- **Play / streaming**: `POST /torrents/{id}/files/{index}/play` (loopback) opens a finished file from disk, or opens a stream URL in
  `preferences.player` (else the first of IINA/VLC/mpv found). `POST …/stream` returns `/api/v1/stream/<token>/<name>`: the
  token (in memory, 6 h sliding, cleared with sessions) is the only credential, so external players need no login; the route
  serves HTTP ranges from librqbit's `FileStream` (Transmission: unsupported). Issuing a link resumes the torrent and wants the file.
  Remote browsers copy the link instead. The web UI never plays video itself: MKV/HEVC/FLAC need a real player.
- **Engine slot** (`AppState.engine`) is `Result<Arc<Engine>, String>`; Err → API `engine_unavailable` (503).
  Settings changes to the engine restart it live; bind/port changes return `restartRequired`.
- **Security**: `auth::guard` enforces a Host allowlist when bound to loopback (anti DNS-rebinding) and rejects
  POST/PUT/DELETE whose `Origin` ≠ Host (anti CSRF), even with auth off. No CORS headers. Auth (off by default)
  = session cookie (`tx_session`, in-memory) or HTTP Basic. Passwords never returned by `GET /settings`.
- **Desktop**: frameless window (`decorations(false)`); the window dots (sidebar head, or the top bar while the
  sidebar is collapsed) render and call `@tauri-apps/api/window` only when `window.__TAURI_INTERNALS__` exists, and `capabilities/window.json` grants just window ops (plus
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
pnpm dev:desktop         # tauri dev; starts Vite and loads the window from it (HMR, no build:web needed)
pnpm build:web | build:server | build:desktop   # server/desktop builds fetch + embed the GeoIP DB
pnpm lint                # i18n key check + ESLint over apps/web + packages, --max-warnings 0
pnpm typecheck
pnpm test                # node --test for packages/query and packages/ui pure logic
cargo test --workspace   # unit + API tests (tower oneshot)
cargo test -p torrentx-rqbit -- --ignored          # network tests (magnet lifecycle, persistence)
TORRENTX_TEST_TRANSMISSION=http://127.0.0.1:9091/transmission/rpc \
  cargo test -p torrentx-transmission -- --ignored # needs a transmission-daemon
```

## Conventions

- Keep the terminal look: monospace for query text, ids, paths and figures; minimal shadows; dark and light parity.
- UI state: local React hooks; polling via `usePoll` (pauses when the tab is hidden).
- Filtering and ordering go through `@torrentx/query` only; a column header edits the `sort:` chip.
- Lint before commits: `pnpm lint`.
- TS: double quotes, semicolons, named exports (`export function Foo`), component props as `interface FooProps`,
  event handlers `handleX`/`onX`. Types come from `@torrentx/api-client` — never redeclare model types in `packages/ui`.
- UI strings go through `t()`; colors use theme tokens (`ui-*`, `packages/ui/src/theme.css`), never Tailwind palette
  colors or hex (`pnpm lint` runs `check-colors.mjs`). `<html data-theme="dark|light" data-accent>` comes from
  `preferences.appearance {mode: system|light|dark, accent}`; legacy `theme`/`useSystemTheme` convert on load.
- Adding a torrent happens in the Spotlight panel (`AddFlow`): a magnet / `.torrent` URL in the input, the
  "Add .torrent" button or ⌘O, or a file dropped on the window. There is no add dialog.
- Spotlight input state is a chip stack plus text (`lib/palette.ts`, pure and tested): `>` = commands, `@␣` = file
  search across torrents (`GET /files`, fetched once per palette, evaluated with `FILE_SEARCH_SCOPE`), and in file
  mode `torrent:␣` picks a torrent and becomes a scope chip bound to its id. On a torrent page `@␣` starts scoped to
  it; Backspace on an empty input pops the last chip. ⏎ on a file opens its Files section with the row highlighted
  (in-memory `focusFile` in `App.tsx`, never in the address). File rows reuse `FileCells` from `FilesSection`.
- Spotlight query mode (input parses with a `field:`): tokens are drawn by a mirror layer behind a transparent input
  (`tokenSpans`); sections CREATE TAB (name prefilled by `suggestTabName`, ⌘S) → FILTER RESULTS (3 library matches +
  "Show all", ⇧⏎ = All tab + lens) → JUMP TO (tabs, files via `fileJumps`) → ACTIONS on the matches (⌘P pause, ⌘L tag).
  ⇥ applies the lens in the active tab. One cursor runs across sections and starts on the first match. The two match
  actions are palette-local keys, not entries in `lib/commands.ts`.
- Every GUI command is registered in `lib/commands.ts` (tag its button with `data-command`); keys come from there.
- Errors: API calls are awaited in `try/catch` and routed to one `handleError` in `packages/ui/src/components/App.tsx`.
- Tests: Rust `cargo test --workspace` (API tests via tower `oneshot`); JS only for pure logic via
  `node --experimental-strip-types --test` (no framework).

## CI and Releases

- `.github/workflows/ci.yml`: lint, typecheck, JS tests, `cargo test --workspace` on every PR and push to `main`.
- Every user-facing PR adds one change file in `.changeset/` (Knope format: `default: minor|patch|major` front matter,
  `# Title`, body; `knope document-change`); tooling-only PRs may use conventional commits instead. The CI `changes`
  job enforces this (Knope CLI 0.23 in Actions; the Knope Bot app is not used).
- `prepare-release.yml` runs `knope prepare-release` on pushes to `main` and keeps a `release` → `main` PR with all
  versions bumped (`knope.toml` `versioned_files`) and `CHANGELOG.md`. Merging it runs `release.yml`: `build.yml`
  binaries → `artifacts/` + `SHA256SUMS.txt` → `knope release` tags `vX.Y.Z` and publishes the release. Re-run via
  workflow_dispatch with the tag to replace assets.
- `nightly.yml`: every push to `main` replaces the `nightly` pre-release with fresh binaries.
- Below 1.0, Knope bumps the patch for `minor` change files and the minor for `major` ones.

## Known Gaps

- The query field `done:` has no data source yet.
- No list virtualization — fine for hundreds of torrents, revisit at thousands.
- `GET /files` returns every file of every torrent in one response (~120 B per file); page it or index server-side if
  libraries reach tens of thousands of files.
- Release binaries are unsigned (macOS Gatekeeper / Windows SmartScreen warn on first launch).
- Features no engine offers stay disabled: OS cache, super seeding, anonymous mode, WebSocket trackers,
  HTTP/SOCKS4 proxy.
- Attached desktop app (server started elsewhere) cannot notify when auth is on (no login for polling).
