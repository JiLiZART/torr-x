## 1. Stable, adaptive row layout

- [x] 1.1 `bytes()` in `packages/ui/src/lib/format.ts` joins number and unit with NBSP; update `format.test.ts`; verify `pnpm test` passes
- [x] 1.2 Export one `COLUMNS` definition (widths + `shrink-0 whitespace-nowrap` + breakpoint visibility: seeds/peers `hidden lg:block`, size/ETA `hidden md:block`, speeds `w-28`) and use it in both the `TorrentList` header and `TorrentItem` cells; verify header and row cells align at 1400 px, 1000 px and 900 px widths
- [x] 1.3 `TorrentItem`: fixed row height (`h-14`) instead of `py-3`, name `min-w-0 line-clamp-2 break-all` with `title` = full name (+ error when set); verify a 300-char name and a 999 KB/s → 1.0 MB/s change leave row height unchanged (DevTools element height)
- [x] 1.4 Verify `pnpm lint` and `pnpm typecheck` pass

## 2. Row activity graph

- [x] 2.1 Add pure `packages/ui/src/lib/activity.ts`: `pushSample` (60-sample cap, drop removed ids, disk = Δ(progress×size)/Δt clamped ≥ 0, reset on gap > 10 s) and `graphPaths(samples)` (area path for down, line paths for up/disk, per-row peak scale); verify with `activity.test.ts` under `pnpm test` (cap, pruning, disk derivation, gap reset, zero-peak scaling)
- [x] 2.2 Add `useActivity(torrents)` hook and wire it in `TorrentList`, passing each row its samples; verify samples accumulate in React DevTools while a torrent downloads
- [x] 2.3 Render the background SVG in `TorrentItem` (absolute, `pointer-events-none`, `preserveAspectRatio="none"`, theme-token fills/strokes, only for downloading/seeding with ≥ 2 samples); verify manually: graph appears on an active download, disappears on pause, hover buttons still clickable
- [x] 2.4 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 3. Window controls in browser

- [x] 3.1 `Header`: render the three dots only when `isTauri()`; verify in `pnpm dev:web` (browser) no dots are shown and in `pnpm dev:desktop` they still close/minimize/maximize

## 4. Rounded desktop window

- [x] 4.1 `apps/desktop/src-tauri`: enable `tauri` feature `macos-private-api`, set `app.macOSPrivateApi: true` in `tauri.conf.json`, add `.transparent(true)` under `#[cfg(not(windows))]` in `open_window`; verify `cargo build -p torrentx-desktop` succeeds
- [x] 4.2 Add `core:window:allow-is-maximized`, `core:window:allow-is-fullscreen`, `core:event:allow-listen`, `core:event:allow-unlisten` to `capabilities/window.json`; verify no permission errors in the window console
- [ ] 4.3 `lib/window.ts` `initDesktopChrome()` (sets `html[data-desktop]`, toggles `data-maximized` on resize) called from `App`; `theme.css` transparent html/body + rounded `#root` (radius 0 when maximized); verify manually on macOS: rounded corners at normal size, square when maximized, square again → rounded after restore; browser build unaffected
- [ ] 4.4 Verify `cargo test --workspace`, `pnpm lint`, `pnpm typecheck` pass

## 5. Docs

- [x] 5.1 Update `CLAUDE.md` Desktop bullet (transparent/rounded window, `macos-private-api`, extra window permissions); verify text matches the implementation
