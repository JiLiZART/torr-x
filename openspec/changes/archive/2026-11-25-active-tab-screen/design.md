## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`): `active-tab.html` (01, dark);
  `active-tab-light.html` (14, light); `filter-builder.html` (05, filter builder popover);
  `active-tab-zero-results.html` (06, zero results); `scope-lens-query.html` (board A); `query-reference.html`
  (board E). Read it for layout, spacing and copy; each element carries its canvas name in `data-pencil-name`.
  Colors there are resolved hex values: map them back to theme tokens, never copy the hex.
- Source of truth: screen 01 (`NaQpo`), the `Row / Torrent (Browser)` component (`IRlhx`, 14 overridable
  parts), the `Chip` and `Tab` component variants, board E (query reference card), board A (scope/lens/query).
- Current code: `TabBar.tsx` (membership tabs), `TorrentList.tsx` (own search/sort state), `Header.tsx`
  (horizontal header), server `store.rs` v2 (tabs + assignments + renames + policy).
- Tokens: `$ui-*` themed ramp (dark/light), `$ui-mono` JetBrains Mono for query text, ids and figures.

## Goals / Non-Goals

**Goals:** the screen as drawn, pixel-faithful in both modes; one query language everywhere; a lens that can
never silently mutate the sidebar; rows that never move under live data.

**Non-Goals:** Spotlight/palette internals (`command-palette-screen`), the detail page
(`torrent-detail-screen`), terminal drawer internals, settings page, virtualization and attention classes
(later changes) — but the list API leaves room for them.

## Decisions

1. **Three layers, one language** (board A): scope = tab query (persistent), lens = extra query ANDed onto it
   (ephemeral, per tab, in memory), query = the text both are written in. Only `Save as tab` writes scope.
   Switching tabs clears the lens; a `restore lens` pill offers the previous lens back on return.
2. **Query package is pure and shared.** Tokenizer → AST → `{evaluate, compare, format, chips, complete}`.
   Fields: `name, state, tag, category, tracker, size, progress, ratio, seeds, peers, down, up, eta, added,
   done, path` (+ section fields registered later by the detail change). Derived states: `active`
   (downloading/seeding with non-zero rate), `stalled` (downloading, no peers or zero rate). `sort:` is an
   ordinary predicate; several comma keys apply left-to-right; numeric defaults desc, text asc; stable ties
   by name. Errors carry column + length + nearest-field suggestion.
3. **Server stores query text verbatim** with `GRAMMAR_VERSION`; it never rejects an unparseable tab — the
   UI shows an error badge and the parse error on hover, and the tab lists nothing. Migration v2→v3:
   assignments become tags, affected tabs get `tag:<slug>`, built-ins seeded when absent
   (All `""`, Downloading `state:downloading`, Seeding `state:seeding`, Stalled `state:stalled`,
   Active `state:active sort:added desc`).
4. **Sidebar sections are derived, not stored**: PINNED = `pinned`, SMART TABS = seeded/`group`ed,
   AD-HOC = the rest; groups collapse; counts are live match counts; the lens badge (funnel + N) shows on
   tabs with an active lens. Ad-hoc tab display name defaults to its query text.
5. **Chips are the lens, rendered from the AST** (`chips(ast)`): key/value/kind, removable, ⌥-click negates,
   ←/→/⌫ keyboard editing, sort chip visually distinct. The fuzzy input is a `name:*text*` predicate source;
   typing never touches the sidebar. Funnel count = predicate count excluding sort.
6. **Row anatomy fixed** (component `IRlhx`): two-line name cell (name clamped, secondary line = tracker ·
   added age, replaced by the state reason when checking/paused/error), size, progress (bar + % or `done`),
   down/up (arrow + rate or `—` when idle), peers, ratio, state word colored, tag chips (max 2 + overflow),
   short tracker. Fixed height; numeric cells NBSP and never wrap; adaptive column hiding at narrow widths
   (from the row-polish change).
7. **Status bar counts are derived from the same evaluation** as the list: `shown of total match this tab +
   lens`; free space from stats; the terminal handle is a slot the terminal change fills.

## Risks / Trade-offs

- **Migration rewrites user tabs.** → Assignments become tags losslessly; a tab's old membership is exactly
  `tag:<slug>`; tests load a v2 fixture and assert the v3 result.
- **Lens loss on tab switch feels abrupt.** → Session snapshot + `restore lens` pill + ⌘Z undo of the last
  chip change.
- **Two sources of ordering (headers vs chips).** → Headers emit `sort:` edits only; no component holds sort
  state; a test asserts header click ≡ typing the chip.
