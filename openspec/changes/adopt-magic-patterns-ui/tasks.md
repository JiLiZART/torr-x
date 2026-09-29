## 0. Prerequisite

- [x] 0.1 Archive `restructure-monorepo-headless-server` (`/opsx:archive`) and verify `openspec/specs/web-ui/spec.md` exists and `openspec validate adopt-magic-patterns-ui` passes

## 1. Core model

- [x] 1.1 Extend `torrentx-core` `Torrent`/`TorrentDetails`/`FileInfo` with the fields in the torrent-engine spec (nullable where unknown), add `Tracker`, `Peer`, `Preview`, `AddOptions`, `Priority`, `Capabilities`, `EngineError::Unsupported`; update `tests/fixtures/torrent.json`; verify `cargo test -p torrentx-core` passes
- [x] 1.2 Mirror types in `packages/api-client` and update `fixture.check.ts`; verify `pnpm typecheck` passes

## 2. rqbit engine

- [x] 2.1 Map new fields (downloaded/uploaded/ratio, pieceSize/pieces, createdBy/comment/createdAt, tracker URLs, file index/wanted) and `capabilities()`; verify with a unit test on a fixture `.torrent`
- [x] 2.2 `add_with_options` (output_folder, sub_folder, paused, only_files) and `preview` (`list_only`); verify ignored network test adds a magnet with a subset of files
- [x] 2.3 `peers` (`api_peer_stats`), `pieces` (`api_dump_haves`), `set_files_wanted` (`update_only_files`), `torrent_file_bytes`; verify unit/ignored tests
- [x] 2.4 Server-assisted `verify` and `relocate` (forget + move + re-add) keeping info-hash; verify ignored test: relocated torrent keeps progress
- [x] 2.5 `apply_settings`: rate limits live; listen port, UPnP, DHT, SOCKS5 via engine restart; verify limits test caps rate

## 3. Transmission engine

- [x] 3.1 Map new fields from `torrent-get` (`trackerStats`, `peers`, `pieces`, `files`/`fileStats`, `bandwidthPriority`, `uploadRatio`, `creator`, `comment`, `dateCreated`) and `capabilities()` from `rpc-version`; verify status/field mapping unit tests with recorded JSON
- [x] 3.2 Add with options (`download-dir`, `paused`, `files-unwanted`, `bandwidthPriority`), preview (add paused → wait metadata ≤ 30 s → read → remove), verify, set-location, rename-path, trackerAdd, file wanted/priority, torrent-file read; verify ignored tests against a daemon
- [x] 3.3 `apply_settings` via `session-set` (limits, peer limits, port, port forwarding, queue, seed ratio, incomplete-dir, cache, dht/pex/lpd, sequential); `host/port/path/https` connection; verify ignored test reads back `session-get`

## 4. Server

- [x] 4.1 Config v2 sections + v1 `url` migration + `config.v1.bak`; verify unit test loading a v1 file
- [x] 4.2 `store.rs` (tabs, assignments, rename overrides, policy data) with atomic writes; verify unit tests for create/rename/delete/assign and restart persistence
- [x] 4.3 Routes: extended torrent endpoints, preview, files, verify/relocate/rename/trackers, magnet, torrent-file, reveal (loopback-only), transmission test, tabs, stats, capabilities; `unsupported` → 501; verify tower oneshot tests per route incl. reveal 403 from non-loopback and guard coverage for new mutations
- [x] 4.4 Stats with `sysinfo` (CPU delta, memory, disk of save path) + session totals; verify test that stats work with engine unavailable
- [x] 4.5 Policy loop (queue, ratio, seed time, move-completed; user-paused vs policy-paused) + event broadcast (completed/added/settings changed); verify unit tests with a fake clock/engine
- [x] 4.6 GeoIP: `scripts/fetch-geoip.sh`, `geoip` feature, embed in release, country lookup in peers; verify lookup test with a known IP when the DB is present
- [x] 4.7 `cargo clippy --workspace -- -D warnings` and `cargo test --workspace` pass

## 5. Web UI foundation

- [x] 5.0 Scaffold `packages/ui` (`@torrentx/ui`: package.json with source `exports`, tsconfig, Tailwind preset, theme CSS) and reduce `apps/web` to the shell importing it (Tailwind `content` includes the package); verify `pnpm lint`, `pnpm typecheck` and `pnpm build:web` pass with the package wired in
- [x] 5.1 Theme tokens (hacker/dark-blue/light, system theme) in Tailwind config + `data-theme`; verify visually in all three themes
- [x] 5.2 i18n context + en/fr/de/es/ru/zh dictionaries + key-parity check script run by `pnpm lint`; verify the check fails on a missing key
- [x] 5.3 Data hooks (`useTorrents`, `useDetails`, `useStats`, `useTabs`, `useCapabilities`, `useSettings`) on `usePoll`; date formatter honoring `dateFormat`; verify `pnpm typecheck`

## 6. Web UI components (port from vendor into `packages/ui`)

- [x] 6.1 Header (search, add/terminal/settings, global rate, window-control dots via `lib/window.ts`, drag region) and StatusBar (stats); verify values match `/stats`
- [x] 6.2 TabBar with server tabs: add, double-click rename, delete, drag-over highlight, drop assigns; verify drag assignment persists across reload
- [x] 6.3 TorrentList (8 sortable columns, search filter, tab filter, ASCII empty state, engine-unavailable banner) and TorrentItem (status stripe, inline pause/resume/remove, more menu with all actions, move-to-tab submenu, capability-disabled items); verify each menu action against a running server
- [x] 6.4 TorrentDetails: General (info rows, speed graph from rolling 60 samples, piece map), Trackers (+ add), Peers, Seeds, Files (tree, expand/collapse all, priority/skip menu); verify with a live multi-file torrent
- [x] 6.5 AddTorrent: URL/File/Magnet tabs, drag-drop, options, preview with info + file tree selection; verify adding with deselected files and paused start
- [x] 6.6 Terminal with `packages/ui/src/lib/terminal.ts` command parser + test (`help`, `list`, `status`, `add`, `pause|resume|remove <prefix>`, `clear`, `exit`); verify test passes and commands work live
- [x] 6.7 Settings modal: General/Network/Downloads/Remote (+ test connection)/Appearance/Advanced/Server sections, capability gating, desktop-only labels, save confirmation, restart notice, exposure warning; verify each control round-trips through `GET /settings`
- [x] 6.8 Browser notifications + completion sound with de-dup, suppressed inside Tauri; update-check notice (daily, dismissible); verify with a completing torrent
- [x] 6.9 Remove obsolete components; `pnpm lint` and `pnpm typecheck` pass

## 7. Desktop

- [x] 7.1 Add `tauri-plugin-autostart` + `tauri-plugin-notification` (capabilities JSON updated); apply autostart on launch and on `SettingsChanged`; verify login item appears/disappears on macOS
- [x] 7.2 Start minimized; quit confirmation when downloading; verify both manually
- [x] 7.3 Native notifications from server events (in-process) or polling (attached); verify notification while window hidden
- [x] 7.4 Frameless window (`decorations(false)`, shadow, min 900×600) + `capabilities/window.json` limited to window ops for the loopback server origin; verify on macOS: no native title bar, red hides to tray, yellow minimizes, green/double-click toggles maximize, header drags, and a plain browser console shows no Tauri errors
- [x] 7.5 `pnpm build:desktop` succeeds

## 8. Docs and end-to-end

- [x] 8.1 Update `CLAUDE.md`, `docs/linux-service.md` (new config sections, GeoIP attribution, reveal limitation on headless)
- [x] 8.2 End-to-end pass in browser and desktop window under rqbit and Transmission: every vendor control either works or is disabled with a hint matching `/capabilities`; record results in the change folder
