## Why

With the shell, tabs, lens and query landed by `active-tab-screen` and the ⌘T palette by
`command-palette-screen`, two product pieces remain from the design (`pen/untitled.pen`, screen 04,
light frames 13–16): the Add Torrent flow that grows out of the palette instead of a modal dialog, and the
token-based light/dark theming with the `appearance`
preference that replaces the old three-theme list.

This change is the remainder of the former `browser-shell-and-spotlight` proposal after its shell, palette and
keyboard-map requirements moved into `active-tab-screen` and `command-palette-screen`.

## What Changes

- **Add Torrent grows out of the palette** (screen 04): pasting a magnet, dropping a `.torrent` or picking a
  file expands the same panel downward (top edge pinned) into the full add flow — metadata header, section
  tabs, file list with its own mini filter bar, save path with free space, options, footer actions. The modal
  Add dialog is removed. **BREAKING (UI)**.
- **Design tokens with light/dark parity**: one neutral ramp plus one accent (`$ui-*`), driven by
  `appearance.mode` (system | light | dark) and `appearance.accent`, replacing `hacker | dark-blue | light`.
  Every surface renders in both modes; fonts served by TorrentX itself.
- **BREAKING (prefs)**: `preferences.theme` / `useSystemTheme` → `preferences.appearance {mode, accent}`,
  migrated on load.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: "Add torrent dialog" (modal → palette expansion), "Localized and themed UI" (tokens, modes,
  offline fonts).
- `app-preferences`: `theme` replaced by `appearance.mode` + `accent` with migration.

## Impact

- `packages/ui`: `palette/AddFlow` (expansion of the palette panel); `AddTorrent.tsx` folded
  in; `Modal.tsx` kept only for destructive confirmations; `theme.css` + Tailwind preset token ramp.
- `packages/api-client` + `crates/torrentx-server/src/config.rs`: appearance preference + migration.
- i18n keys in six dictionaries.
- Depends on `active-tab-screen` (shell, query, file-scoped fields) and `command-palette-screen` (the panel
  this flow expands). `add-preflight-and-provenance` later extends the add flow's save-path row.

The empty-library state (screen 17) moved to `empty-library-and-first-run`.
