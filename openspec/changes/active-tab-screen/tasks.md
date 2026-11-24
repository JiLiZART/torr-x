## 1. Query package

- [x] 1.1 Create `packages/query` (pure TS, no runtime deps): field registry, tokenizer, parser → AST
      (predicates, negation, comparisons, ranges, quoted phrases, wildcards, AND/OR, one grouping level,
      `sort:` keys); verify `node --test` covers every form
- [x] 1.2 `ParseError {message, column, length, suggestion}`; verify `statu:active` → column 0, length 5,
      suggestion `state`
- [x] 1.3 `evaluate(ast, torrent)` incl. derived `state:active`/`state:stalled`; `compare(sort)` with default
      directions and stable ties; verify tests for derived states, ranges, OR groups, multi-key sort
- [x] 1.4 `format(ast)`, `chips(ast)`, `complete(input, caret)`; verify round-trip
      `format(parse(x)) === format(parse(format(parse(x))))` on a query fixture list and completion cases
- [x] 1.5 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 2. Server: tags and saved-query tabs

- [x] 2.1 `crates/torrentx-core`: `Torrent.tab_id` → `tags: Vec<String>`; update drift fixture +
      `packages/api-client` together; verify `cargo test -p torrentx-core` + fixture check
- [x] 2.2 `store.rs`: `Tab {id, name, query, order, pinned, group}`, tag map with normalization (trim,
      lowercase, dedupe, ≤32 tags, ≤64 chars), v2→v3 migration seeding built-ins; verify migration test on a
      v2 fixture and normalization limits
- [x] 2.3 `api.rs`: `GET/POST /tabs`, `PATCH/DELETE /tabs/{id}`, `PUT /torrents/{id}/tags`; old
      `PUT /torrents/{id}/tab` → 410 with pointer; unparseable tab query round-trips verbatim with
      `GRAMMAR_VERSION`; verify tower `oneshot` tests
- [x] 2.4 Verify `cargo test --workspace` passes

## 3. Shell chrome

- [x] 3.1 `Shell` + `Sidebar`: collapse, ⌘T trigger, PINNED/SMART TABS/AD-HOC sections, live counts, lens
      badges, collapsible groups, `+ New tab`, `Save current lens as tab ⌘S`, transfer totals; verify against
      a running server that counts match the list and badges appear only with an active lens
- [x] 3.2 `TopBar`: back/forward slots, tab title + `lens · N filters` badge + "scoped to this tab", density /
      terminal / settings / account slots; verify the badge count equals chip predicate count
- [x] 3.3 `StatusBar`: `N of M torrents match this tab + lens`, free space, terminal handle slot; verify the
      count equals the rendered row count under a lens
- [x] 3.4 Tab interactions: activate, rename (F2/double-click), reorder by drag, pin/unpin, group, delete with
      confirmation for non-trivial queries; error badge + hover parse error for unparseable tabs; verify each
      persists across reload
- [x] 3.5 Addresses + back/forward: every view addressable, reload restores the view without a lens, stale
      addresses fall back to All with a notice; verify tab→tab→back→forward and reload
- [ ] 3.6 Desktop window controls: dots in sidebar head (top bar when collapsed), drag areas, double-click
      maximize, hidden in plain browser; verify in `pnpm dev:desktop` and in a browser

## 4. Filter bar, chips, lens

- [x] 4.1 `FilterBar`: fuzzy input, funnel + count, chip row (always visible, wrapping), `+ filter`,
      `Save as tab`, collapse; verify chips stay visible when collapsed
- [x] 4.2 `Chip` states (default/active/sort/dragging), removal, ⌥-click negation, ←/→/⌫ navigation; verify
      against the component variants on canvas
- [x] 4.3 Lens state per tab: ANDed onto tab query, cleared on switch, session snapshot + `restore lens` pill,
      ⌘Z undo; verify switching tabs and back
- [x] 4.4 `FilterBuilder` popover: predicate rows (field/operator/value), ALL/ANY + one nested OR group, sort
      row, live query preview with copy, `Apply lens`, `Save as tab`; verify built predicates produce chips
      identical to typing the same query
- [x] 4.5 `Save as tab` inline confirm (editable name, query shown), clears the producing lens, undoable,
      duplicate-query offer to jump; verify it is the only action that adds a sidebar entry
- [x] 4.6 Verify `pnpm lint`, `pnpm typecheck` pass and i18n keys exist in all six dictionaries

## 5. List and rows

- [x] 5.1 `TorrentList` evaluates tab query AND lens through `@torrentx/query` only; headers edit the sort
      chip; verify header click ≡ typing the same `sort:` predicate
- [x] 5.2 `TorrentRow` per the `Row / Torrent` component: two-line name cell with state-reason secondary line,
      progress bar/`done`, rates/`—`, state color, tag chips, short tracker; fixed height, NBSP figures;
      verify no row moves or resizes during 1 Hz updates
- [x] 5.3 Zero-results state naming tab query vs lens and the responsible predicate with Clear lens / remove
      predicate actions; verify with `size:>100GB` on a smaller library
- [ ] 5.4 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test`, `cargo test --workspace` pass; manual check of
      screen 01 in dark and light against the canvas frame

## 6. Docs

- [x] 6.1 Update `CLAUDE.md` (packages/query, tabs-as-queries, tags) and remove superseded deltas per the
      proposal; verify text matches implementation
