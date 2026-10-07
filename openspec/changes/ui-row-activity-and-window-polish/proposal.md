## Why

Torrent rows jump in height when live values change (sizes/speeds wrap onto a second line in narrow windows,
fixed-width columns shrink), active torrents give no sense of recent throughput, the web version shows desktop
window buttons that do nothing, and the frameless desktop window has hard square corners.

## What Changes

- **Stable row layout**: every torrent row has one fixed height regardless of name length, window width or live
  values. Numeric cells never wrap (non-breaking space between number and unit for sizes too, not just rates);
  fixed columns never shrink; long names clamp to two lines with the full name in a tooltip.
- **Adaptive columns**: at narrower widths lower-priority columns (seeds/peers, then size/ETA) are hidden in both
  the header and the rows instead of squeezing the rest.
- **Row activity graph** (Steam-style): a downloading or seeding row shows a faint background graph of its recent
  history — download speed (filled area), upload speed (line) and disk write rate (line) — drawn behind the row
  content and scaled per row. History is kept in the browser only (last ~90 s), no API change.
- **Window controls only in the desktop app**: the red/yellow/green header dots are not rendered in a plain
  browser. **Modifies** the pending `adopt-magic-patterns-ui` "Window controls" requirement ("in a plain browser
  the dots SHALL render but do nothing").
- **Rounded desktop window**: the frameless desktop window has rounded corners (square while maximized/fullscreen).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: stable/adaptive torrent row layout, row activity graph, window controls hidden in the browser.
- `desktop-app`: rounded window corners.

## Impact

- `packages/ui`: `TorrentItem.tsx`, `TorrentList.tsx` (shared column definitions, history hook), `Header.tsx`,
  `lib/format.ts` (`bytes()` NBSP), new pure history/graph module + `node --test`, `lib/window.ts`
  (desktop chrome flag, maximized state), global CSS.
- `apps/desktop/src-tauri`: window builder `transparent(true)` (macOS/Linux), `tauri` feature `macos-private-api`,
  `tauri.conf.json` `app.macOSPrivateApi: true`, window capability gains `is-maximized` + resize event listen.
- No HTTP API, model or server changes. No new JS dependencies.
- Ordering: archive `adopt-magic-patterns-ui` before this change (the web-ui delta modifies its "Window controls"
  requirement).
