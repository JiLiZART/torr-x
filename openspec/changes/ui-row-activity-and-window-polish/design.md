## Context

- `TorrentItem.tsx` hard-codes its column widths (`w-20`/`w-24`) separately from `COLUMNS` in `TorrentList.tsx`.
  Cells are flex children without `shrink-0`, so they shrink at small widths; `bytes()` uses a normal space, so
  "1023.5 MB" wraps in an 80 px cell. `rate()` already pads to 10 NBSP-joined chars, but 10 monospace chars at
  `text-sm` (~84 px) exceed a `w-24` cell's 80 px content box. The progress cell is bar + percent on two lines.
- Torrent list is polled every 1.5 s (`useTorrents` → `usePolled(api.list, 1500)`); `usePoll` pauses when hidden.
- The model has `downloadRate`, `uploadRate`, `progress`, `size` per torrent; no disk-rate field.
- Desktop window: `WebviewWindowBuilder` with `decorations(false)`, `shadow(true)`; capability `window-controls`
  grants hide/minimize/toggle-maximize/start-dragging to the loopback origin. `isTauri()` in `lib/window.ts`.
- The pending `adopt-magic-patterns-ui` change introduces the "Window controls" requirement this change modifies.

## Goals / Non-Goals

**Goals:** fixed row height; one column definition shared by header and row; client-only activity history; rounded
desktop corners with a clean maximized state.

**Non-Goals:** server-side rate history or new API fields; charts in the details panel; a charting library;
virtualization; user-configurable column visibility.

## Decisions

1. **Single column table.** Move the width/visibility classes into one exported `COLUMNS` list used by the header and
   `TorrentItem`. Fixed columns get `shrink-0 whitespace-nowrap`; speeds widen to `w-28`. Name cell is
   `min-w-0 flex-1` with `line-clamp-2 break-all` (Tailwind 3.3+ built-in) and `title={name}` (error appended when
   set). Row gets a fixed height (`h-14`, fits two name lines and bar+percent) instead of `py-3`.
   *Alt:* CSS grid template — cleaner alignment but a bigger rewrite of both components for the same result.
2. **Responsive hiding via viewport breakpoints** (`hidden lg:block` for seeds/peers, `hidden md:block` for size/ETA),
   applied through the shared `COLUMNS` so header and row can't drift. The list is always ~full window width (details
   panel sits below), so viewport width ≈ list width. *Alt:* container queries — needs
   `@tailwindcss/container-queries`, a new dependency for no practical gain here.
3. **`bytes()` joins with NBSP** like `rate()`. Only visual; tests in `format.test.ts` updated.
4. **History in the UI, not the server.** A pure module `lib/activity.ts`: `pushSample(history, torrents, now)`
   returns a new `Map<id, Sample[]>` capped at 60 samples (~90 s at 1.5 s), dropping ids no longer listed. A sample is
   `{ t, down, up, disk }` where `disk = max(0, Δ(progress × size) / Δt)` from the previous sample (0 for the first).
   Disk ≠ download: it counts verified payload written, excluding overhead/wasted data — the closest honest proxy
   without an engine metric. A `useActivity(torrents)` hook in `TorrentList` keeps the map in a ref-backed state
   updated when `torrents` changes. A pure `graphPaths(samples, w, h)` builds SVG path strings.
   *Alt:* server ring buffer + `GET /torrents/:id/history` — survives reloads but adds API surface, memory per
   torrent and both engines' plumbing; not needed for a glanceable background.
5. **Rendering:** an `absolute inset-0 pointer-events-none` SVG as the row's first child, `viewBox="0 0 100 100"`
   with `preserveAspectRatio="none"` and `vector-effect="non-scaling-stroke"`; row content sits above with `relative`.
   Download = filled area `fill-tx-accent-500/10`, upload = stroke `tx-accent-700`, disk = dashed stroke
   `tx-accent-600`. Y scale = row's peak of all three series (min 1 B/s). Shown only for `downloading`/`seeding` with
   ≥ 2 samples. No axes, no labels.
6. **Hide dots in the browser:** `Header` renders the dot group only when `isTauri()`.
7. **Rounded window:**
   - Rust: `.transparent(true)` on macOS and Linux only (`#[cfg(not(windows))]`); Windows 11 DWM already rounds
     undecorated windows that have a shadow, and transparency there breaks the shadow. macOS transparency needs the
     `tauri` feature `macos-private-api` and `app.macOSPrivateApi: true` in `tauri.conf.json`.
   - Web: `initDesktopChrome()` in `lib/window.ts` (called once from `App` when `isTauri()`) sets
     `<html data-desktop>`; `theme.css` makes `html[data-desktop]` and `body` transparent and gives `#root`
     `border-radius: 10px; overflow: hidden` with the theme background. It listens to `onResized` and toggles
     `data-maximized` from `isMaximized()` / `isFullscreen()`, which zeroes the radius.
   - Capability `window-controls` gains `core:window:allow-is-maximized`, `core:window:allow-is-fullscreen` and
     `core:event:allow-listen` (+ `allow-unlisten`) — read-only/event permissions, no new commands.

## Risks / Trade-offs

- [`macos-private-api` blocks Mac App Store submission] → Not a distribution target; noted in the Cargo feature
  comment.
- [Linux without compositor paints transparent areas black] → Corners look square-ish black; functional. Accepted.
- [History resets on reload and gaps when the tab is hidden] → Acceptable for a glanceable graph; a gap > 10 s
  clears that torrent's history so the graph doesn't draw a misleading slope.
- [Per-row SVG on every 1.5 s refresh] → Only active rows render one; path of ≤ 60 points is trivial for hundreds
  of rows.
- [Two-line names reduce rows per screen] → `h-14` vs the current ~`py-3` two-line height is roughly equal.

## Migration Plan

Archive `adopt-magic-patterns-ui` first (this web-ui delta modifies its "Window controls" requirement). No data or
config migration; rollback = revert.
