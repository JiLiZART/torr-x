## Context

- Source boards: E (`e54dm`, a reusable component on the canvas) and F (`vxoQM`).
- `active-tab-screen` defines the grammar and registry; `command-palette-screen` defines the registry of
  commands and a keymap module; `terminal-drawer` renders the same card in its FIELDS popover.

## Goals / Non-Goals

**Goals:** one reference card, generated not hand-written; every binding in the sheet is real data in one
table that also drives the hotkeys; no binding documented but unimplemented.

**Non-Goals:** user-remappable keys; a tutorial mode; localization of field names (fields stay English,
descriptions are translated).

## Decisions

1. **Registry is the source of the card.** Each field: `{name, aliases, type, scope[], examples[]}`. The
   card, the completion source and the unknown-field suggestion all read it; a test fails if a field renders
   in the card without a parser test or vice versa.
2. **Value groups are sugar for OR on one field.** `tag:(4k OR shows)` parses to `(tag:4k OR tag:shows)`;
   `format()` emits the grouped form when all arms share a field. Still one level of nesting.
3. **`enum*` means open enum.** Values come from live data (tags), completion offers current values, unknown
   values are legal (they just match nothing and are not an error).
4. **Keymap is data.** `{keys, label, scope, group, commandId}`; scope controls where the hotkey is live
   (e.g. `chip row` only when the chip row has focus); the sheet groups by `group`; platform rendering swaps
   ⌘/⌥ for Ctrl/Alt. A test asserts no two bindings collide within overlapping scopes.
5. **Reconciliations with earlier changes.** New ad-hoc tab is `⌘⇧T`; `⌘P` opens Spotlight in jump mode and
   `⌘⇧P` in command mode (`>`); `⌘B` toggles the sidebar; `⌘,` opens settings; `⌘/` toggles the card.
6. **Copy is canonical.** `⌘C` on the focused chip row writes `format(ast)` to the clipboard; pasting it into
   any other surface reproduces the same chips (round-trip test shared with the query package).

## Risks / Trade-offs

- **Browser-reserved shortcuts** (`⌘T`, `⌘W`, `⌘P`, `⌘S` in browsers). → The sheet shows the bindings that
  work in the current environment and the fallback; in the desktop app all work as drawn.
- **Large table drifts from implementation.** → Table is data driving both hotkeys and the sheet.
