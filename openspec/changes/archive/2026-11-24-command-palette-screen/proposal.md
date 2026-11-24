## Why

Screen 08 (`pen/untitled.pen`, `x8HOA5` "Command Palette — grouped (same surface as ⌘T)") defines the one
place to type anything: a single centered panel that is simultaneously a jump surface, a filter entry and the
command palette — "every GUI command appears here; if it doesn't, it's a bug". Today no such surface exists
(only a header search box). This change implements it from the ground up on top of `active-tab-screen`.

**Replaces** the Spotlight/palette/keyboard-map portions of the pending `browser-shell-and-spotlight`
change (trimmed to `add-flow-and-theming`, which keeps the Add-flow expansion and empty-library state); the
full keyboard map is carried here.

## What Changes

- **One surface (⌘T)**: a centered panel over a dimmed, blurred window; input prefixed `>`; plain text ranks
  jump targets (tabs, torrents); a structured query switches the panel to grouped sections. Header hint:
  "⌘T is one surface: jump · filter · act".
- **Grouped sections, never mixed** (as drawn):
  - **ACTIONS** — every registered GUI command with its icon, scope label (`selection`, `tab · Active`,
    `global`) and keybinding (e.g. Pause selected torrent `Space`, Pause all in this tab `⌘⇧P`, Pause
    everything `⌘⌥P`, Resume paused in this tab `⌘⇧R`). Commands act on their declared scope, never on the
    typed text.
  - **FILTER** — the parsed query as a lens result: `state:paused` → "lens · tab “Active” · 6 matches" (`⇥`
    applies), plus `state:paused in All torrents` (`⇧⏎` switches to the pinned All tab and applies the same
    lens). Filtering applies only to the active tab unless the All variant is chosen.
  - **JUMP TO** — matching tabs and torrents with context lines (smart tab `Paused · state:paused`;
    `archlinux-…iso · paused at 12.5%`), `⏎` navigates.
  - **CREATE TAB** — `Save “<query>” as a smart tab` (`⌘S`), highlighted; "the only thing in this list that
    touches the sidebar".
- **Plain text never auto-filters**: typing filters nothing until a filter result is chosen or `⇥` is
  pressed; only a parseable structured query engages the grouped mode on its own.
- **Keyboard**: `↑↓` navigate, `⏎` run, `⇥` switch section, `⌘K` shortcut sheet, `esc` dismiss — shown in the
  panel footer. A command registry + keymap module backs the palette, the shortcut sheet and every surface's
  bindings; scopes are enforced (selection commands disabled without a selection).
- **Pinned "All torrents" escape hatch** always present in jump results for global filtering.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: the ⌘T palette surface, grouped sections, command registry and keyboard map.

## Impact

- `packages/ui`: new `palette/` (`Palette`, `Section`, `ResultRow`, `KeyHint`), `lib/commands.ts` (registry:
  id, label, icon, scope, keybinding, run), `lib/keymap.ts`, `ShortcutSheet`; every existing GUI action
  registers a command; i18n keys in six dictionaries.
- `packages/query`: reused as-is (parse detection, evaluation for match counts, completion).
- No server/API changes: commands call existing endpoints; match counts computed client-side.
- Depends on `active-tab-screen` (shell, tabs, lens, query). The Spotlight add-flow expansion (screen 04)
  stays out of scope here.
