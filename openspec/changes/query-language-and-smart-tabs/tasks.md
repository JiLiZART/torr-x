## 1. Query package

- [ ] 1.1 Create `packages/query` (`@torrentx/query`, TS, no runtime deps) with the field registry from the
      reference card (board E): `name, state, tag, category, tracker, size, progress, ratio, seeds, peers,
      down, up, eta, added, done, path` and the file/peer/tracker-scoped fields `ext, priority, ep, season,
      country, client, flags, status`; verify `pnpm typecheck` passes for the new package
- [ ] 1.2 Tokenizer + parser producing a serializable AST: `field:value`, `!`, `> < >= <=`, `a..b`, quoted
      phrases, `*` wildcards, implicit `AND`, explicit `AND`/`OR`, one level of `( )`, and `sort:` keys with
      optional direction; verify `node --test` cases cover each form
- [ ] 1.3 `ParseError {message, column, length, suggestion}` with nearest-field suggestion for unknown fields;
      verify `statu:active` yields column 0, length 5 and suggestion `state`
- [ ] 1.4 Evaluator: `evaluate(ast, torrent, ctx)` including derived `state:active` and `state:stalled`, plus
      `compare(sort)` with per-type default directions and stable ties by name; verify tests for derived states,
      range, negation, OR group and multi-key sort
- [ ] 1.5 `format(ast)` (canonical text) and `chips(ast)` (ordered key/value/kind for rendering); verify
      round-trip `format(parse(x)) === format(parse(format(parse(x))))` on a fixture list of queries
- [ ] 1.6 `complete(input, caret, source)` returning field, operator and value completions; verify tests for
      completing a bare word, a field name and a value after `state:`
- [ ] 1.7 Export `GRAMMAR_VERSION`; verify `pnpm lint`, `pnpm typecheck` and `pnpm test` pass

## 2. Server: tags and saved-query tabs

- [ ] 2.1 `crates/torrentx-core`: replace `Torrent.tab_id` with `tags: Vec<String>`; update
      `tests/fixtures/torrent.json` and `packages/api-client/src/fixture.check.ts` together; verify
      `cargo test -p torrentx-core` and `pnpm --filter @torrentx/api-client test` pass
- [ ] 2.2 `store.rs`: `Tab {id, name, query, order, pinned, group}`, a `tags: HashMap<String, Vec<String>>` map
      with normalization (trim, lowercase, dedupe, ≤32 tags, ≤64 chars), and `set_tags`/`tags_of`; verify unit
      tests for normalization and limits
- [ ] 2.3 v2→v3 migration: assignments become tags, each affected tab's query becomes `tag:<slug>`, built-in
      tabs are seeded when no tabs exist; verify a test loading a v2 fixture produces the expected v3 state
- [ ] 2.4 `api.rs`: `GET/POST /tabs`, `PATCH/DELETE /tabs/{id}` with the new fields, `PUT /torrents/{id}/tags`,
      and `PUT /torrents/{id}/tab` responding 410 with a pointer to the new route; verify `cargo test --workspace`
      passes including new tower `oneshot` cases
- [ ] 2.5 Reject a tab whose query does not parse? No — the server stores text verbatim and records
      `GRAMMAR_VERSION`; verify a tab with an unparseable query round-trips through `GET /tabs` unchanged

## 3. UI: sidebar tabs

- [ ] 3.1 Replace `TabBar.tsx` with a left sidebar list: pinned section, smart tabs, groups (collapsible),
      ad-hoc section, `+ New tab` and `Save current lens as tab`; verify the sidebar renders the seeded tabs
      against a running server
- [ ] 3.2 Tab interactions: activate, rename in place (F2 / double-click), reorder by drag, pin/unpin, group,
      delete with confirmation for a tab holding a non-trivial query; verify each persists across reload
- [ ] 3.3 Per-tab counts and the lens badge (shown when the tab has an active lens); verify the badge appears on
      a tab with 2 lens predicates and disappears when the lens is cleared
- [ ] 3.4 A tab whose stored query fails to parse shows an error badge and its parse error on hover, and lists
      nothing; verify with a hand-edited `state.json`
- [ ] 3.5 Verify `pnpm lint`, `pnpm typecheck` pass and i18n keys exist in all six dictionaries

## 4. UI: filter bar, chips and builder

- [ ] 4.1 `FilterBar` under the top bar: fuzzy name input, funnel button with predicate count, chip row
      (wrapping, never collapsing), `+ filter`, `Save as tab`, collapse control; verify chips stay visible when
      the bar is collapsed
- [ ] 4.2 `Chip` component with default / active / sort / dragging states, removal, ⌥-click negation and
      keyboard navigation (← →, ⌫); verify with the component states on board D
- [ ] 4.3 `FilterBuilder` popover: predicate rows (field, operator, value), AND/OR group, sort row, live query
      preview with copy, `Apply lens` and `Save as tab`; verify applying produces chips identical to typing the
      same query
- [ ] 4.4 Lens state keyed by tab id: cleared on tab switch, snapshotted for the session, `restore lens` pill on
      return, ⌘Z undo of the last chip change; verify switching tabs and back
- [ ] 4.5 `TorrentList` filters and sorts through `@torrentx/query` only; column headers edit the sort chip
      instead of holding their own sort state; verify sorting by size twice matches the previous behavior
- [ ] 4.6 Zero-results state naming tab query vs lens and the predicate responsible, with Clear lens / remove
      predicate / open builder / search all actions; verify with `size:>100GB` on a library whose largest
      torrent is smaller
- [ ] 4.7 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test` and `cargo test --workspace` pass

## 5. Docs

- [ ] 5.1 Update `CLAUDE.md` (new `packages/query`, tabs-as-queries, tags replacing `tabId`) and
      `openspec/config.yaml` context if the invariant list changes; verify the text matches the implementation
