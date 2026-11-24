## Why

With tabs, lens and chips in place (`query-language-and-smart-tabs`), the window around them is still the old
one: a horizontal header with a search box, a modal Add dialog, and three named themes. The design
(`pen/untitled.pen`, screens 01–04, 08, 17 and boards B, C, F) moves TorrentX to browser chrome — sidebar-first
navigation, one centered Spotlight that is also the command palette, and an Add flow that grows out of that
panel instead of opening a dialog on top of it.

The product rule behind it: there is exactly one place to type anything (⌘T), it is a jump surface first, and it
only filters when what you typed parses as a query.

## What Changes

- **Browser shell**: left sidebar (window controls, Spotlight trigger, tab list, new-tab / save-lens actions,
  transfer totals) + main area (top bar with back/forward and the tab title, filter bar, list, status bar).
  Translucent chrome, rounded corners, no horizontal tab strip.
- **Spotlight (⌘T) is the command palette**: one centered panel over a dimmed, blurred window. Plain text ranks
  jump targets; a structured query switches the panel to grouped sections — *Create tab from this query*
  (highlighted), *Filter results*, *Jump to*, *Actions* — each labelled, never mixed. A pinned "All torrents"
  entry is the global escape hatch.
- **⌘T never auto-filters**: typing plain text filters nothing until the user picks a filter result or presses
  Tab; filtering engages on its own only when the input parses as a structured query.
- **Add Torrent grows out of Spotlight**: pasting a magnet, dropping a `.torrent` or picking a file expands the
  same panel downward (top edge pinned) into the full add flow — metadata header, section tabs, file list with
  its own mini filter bar, save path, options, footer actions. The modal Add dialog is removed.
- **Empty library state** for a library with no torrents at all, explicitly distinct from a lens that filtered
  everything out: drop zone, paste/add/Spotlight actions and three orientation cards.
- **Design tokens with light/dark parity**: one neutral ramp plus one accent, driven by `appearance.mode`
  (system | light | dark) and an accent choice, replacing the `hacker | dark-blue | light` theme list. Every
  surface must render in both modes.
- **Navigation history**: every view has an address (a tab now; the torrent page and settings in later changes),
  so back/forward and reload work. The status bar becomes match counts + engine + free space; transfer totals
  move to the sidebar.
- **Keyboard map**: every surface operable without a mouse; ⌘K opens the shortcut sheet; the palette shows each
  command's keybinding and scope.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: browser shell layout, Spotlight/palette as one surface, Add Torrent as a Spotlight expansion, empty
  library state, navigation history, keyboard map, design tokens and light/dark parity. **Modifies** the
  `adopt-magic-patterns-ui` requirements "Window controls", "Add torrent dialog", "Status bar" and "Localized
  and themed UI".
- `app-preferences`: `theme` is replaced by `appearance.mode` + `accent`, with migration of stored values.

## Impact

- `packages/ui`: new `Shell`, `Sidebar`, `TopBar`, `Spotlight` (panel, sections, result rows, add flow),
  `EmptyLibrary`, `ShortcutSheet`; `AddTorrent.tsx` folded into the Spotlight add flow; `Header.tsx` removed;
  `Modal.tsx` kept only for destructive confirmations; new `lib/keymap.ts` and `lib/shortcuts.ts`.
- `packages/ui/src/theme.css` + Tailwind preset: new token ramp (`--tx-*` surfaces, text, accent, semantic
  states) defined once per mode; every component moves to tokens, no literal colors.
- `packages/api-client` + `crates/torrentx-server/src/config.rs`: `preferences.theme`/`useSystemTheme` →
  `preferences.appearance {mode, accent}`, migrated on load.
- i18n: new keys in all six dictionaries (`pnpm lint` enforces parity).
- No engine or torrent-model changes.
- Depends on `query-language-and-smart-tabs` (Spotlight's query mode and the "Create tab" section use the
  parser and save-as-tab). Ordering: archive `adopt-magic-patterns-ui` first.
