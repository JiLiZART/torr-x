## Why

Boards E ("Query language reference card") and F ("Keyboard map", `pen/untitled.pen` `e54dm`, `vxoQM`) are
the two reference artifacts every surface leans on: the card that teaches the grammar in place, and the full
list of bindings that makes "every surface operable without a mouse" checkable. The screen changes mention
both in one line each ("keyboard map", "completion source") but none specifies the card, its exact field
table, the value-group syntax it shows (`tag:(4k OR shows)`), or the concrete bindings. This change makes
them real and testable.

## What Changes

- **Query reference card**: one reusable component, identical in the filter builder, the palette and the
  terminal, toggled by `⌘/` from any input. Sections: FIELD / TYPE / EXAMPLE / scope table (list · files ·
  files·media · peers · trackers·web seeds), OPERATORS, SORT ("a predicate, never a column control"),
  EXAMPLES, RULES. Generated from the shared field registry so it can never drift from the parser.
- **Grammar additions the card shows**: value groups `field:(a OR b)` (`tag:(4k OR shows)`,
  `ext:(srt OR sub)`), `progress:<50` percent values, `ratio:0..0.5` ranges on decimals, byte ranges
  `size:700MB..2GB`; field set finalized with types (`enum*` = enum from stored values, e.g. tags).
- **Parser rules from the card**: an unknown field never silently returns nothing — it raises the inline
  error with a suggestion; a lens is ANDed onto the tab query and the tab query is never rewritten; every
  surface renders the same chips for the same string; `⌘C` on the chip row copies the canonical query text.
- **Full keyboard sheet** (`⌘K`): six groups — Spotlight·Palette, Tabs·Scope, Lens·Chips, Terminal,
  List·Selection, Navigation·Detail — each binding with its scope (global, spotlight, add flow, tab view,
  sidebar, chip row, drawer, input, list, detail). macOS shown; ⌘→Ctrl and ⌥→Alt elsewhere.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `torrent-query`: value groups, percent/decimal/byte ranges, field typing and scope metadata, unknown-field
  rule, canonical copy.
- `web-ui`: query reference card; the keyboard sheet and its binding table (**refines** the "Keyboard map"
  requirement of `command-palette-screen`).

## Impact

- `packages/query`: field registry gains `type`, `scope`, `examples` (the card renders from it); parser
  accepts value groups; `node --test` for each new form.
- `packages/ui`: `QueryReference` component + `⌘/` toggle; `lib/keymap.ts` binding table as data with scope;
  `ShortcutSheet` renders it; i18n keys.
- Conflict resolved: the sidebar hint for new tab is `⌘⇧T` (board F); `⌘T` is Spotlight only.
- Depends on `active-tab-screen` (query package, chips) and `command-palette-screen` (registry, keymap).
