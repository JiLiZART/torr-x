## Context

- Today's tab model (`crates/torrentx-server/src/store.rs`): `Tab {id, name, order}` plus an `assign` map
  `torrent -> Option<tab>`, surfaced as `Torrent.tab_id` and `PUT /torrents/{id}/tab`. Built-in All /
  Downloading / Completed are hard-coded in the UI (`TabBar.tsx`) and filter by status/progress.
- Filtering is `TorrentList`'s own `search` state (case-insensitive name substring); sorting is its own
  `sort`/`dir` state driven by column-header clicks (`lib/columns.ts`).
- `Status` is `downloading | seeding | paused | checking | queued | error` — there is no `stalled` status.
- `packages/ui/src/lib/terminal.ts` already parses a small command line; `adopt-magic-patterns-ui` shipped it
  with its own ad-hoc argument handling. The next change replaces its filtering with this parser.
- The list is polled every 1.5 s and holds every torrent in memory; there is no server-side filtering today.

## Goals / Non-Goals

**Goals:** one parser shared by every surface; tabs that are saved queries; many tags per torrent; a lens that
is visibly scoped to the active tab; chips that are never hidden; sort expressed as a predicate.

**Non-Goals:** server-side filtering or a filtering API; a Rust implementation of the grammar; a standalone
`torrentx` CLI binary; full-text search inside file names across all torrents; saved searches shared between
users (single-user product); virtualized lists.

## Decisions

1. **One TypeScript package, client-side evaluation.** `packages/query` exports `parse(input) -> Ast | ParseError`,
   `evaluate(ast, torrent, ctx) -> boolean`, `compare(ast.sort)`, `format(ast) -> string`, `chips(ast)` and
   `complete(input, caret)`. The UI, the terminal and Spotlight all call it, which is what makes "same syntax,
   same errors, same autocomplete" testable rather than aspirational.
   *Alt:* evaluate on the server behind `GET /torrents?q=`. Rejected for now: it needs a second implementation
   in Rust for the same grammar, and the list already arrives whole every 1.5 s. The AST is kept serializable so
   a server-side evaluator can be added later without changing the stored tab strings.
2. **Tabs store the query text, not the AST.** `state.json` keeps `query: String`; the UI parses on load. Text
   survives grammar extensions, is diffable, and is what the user typed. An unparseable stored query makes the
   tab show a broken badge and its parse error instead of silently listing everything.
3. **Built-in tabs are seeded rows, not special cases.** On first load after migration the store seeds
   `All (query "", pinned)`, `Downloading (state:downloading, pinned)`, `Completed (progress:100)`. They are
   ordinary tabs afterwards: renameable, deletable, reorderable. The UI keeps one hard rule — if no tab exists,
   it shows an "All" tab with an empty query so the list is never unreachable.
4. **Tags replace membership.** `tags: Vec<String>` per torrent in `state.json`, many per torrent, normalized to
   lowercase, trimmed, deduplicated, max 32 per torrent and 64 chars each. Migration v2→v3: for every existing
   assignment, add the tab's name (slugified) as a tag to that torrent and set that tab's query to `tag:<slug>`.
   A user who never used tabs gets no tags. This keeps every pre-existing tab working on first launch.
5. **`state:` is a facade over status plus derived values.** `state:` accepts `downloading, seeding, paused,
   checking, queued, error` (the model) plus two derived values: `active` (downloading or seeding with a non-zero
   rate) and `stalled` (downloading, no peers or zero rate). Derived values are computed in the evaluator from
   fields the list already carries — no model change, and the UI's status colors stay the source of truth.
6. **Lens lives in React state, keyed by tab id.** Switching tabs clears the visible lens and snapshots the old
   one in a session map, so returning offers "restore lens" without persisting anything. Nothing about the lens
   reaches the server; that is the mechanical guarantee behind "filtering never mutates the sidebar".
7. **Sort is a predicate with a default direction.** `sort:` takes one or more keys; numeric and date keys
   default to `desc`, text keys to `asc`. Column headers no longer sort; clicking a header edits the sort chip
   instead, so there is exactly one place sorting can come from.
   *Alt:* keep header sorting as a shortcut that writes the chip. Deferred — it reintroduces two code paths
   before the chip UI has shipped.
8. **Chips wrap, never collapse.** The filter bar grows to a second line rather than hiding predicates behind
   the funnel; the funnel's count always equals the number of lens predicates including sort.

## Risks / Trade-offs

- **Breaking model change** (`tabId` → `tags`): mitigated by the store migration and by updating the Rust model,
  `packages/api-client` and `crates/torrentx-core/tests/fixtures/torrent.json` in the same task group, as the
  project invariant requires.
- **Grammar lock-in**: once tabs store text, syntax changes need a migration. Mitigated by keeping the surface
  small (no arithmetic, one grouping level) and by versioning the grammar in `packages/query` with a
  `GRAMMAR_VERSION` constant recorded in `state.json`.
- **Client-side evaluation at scale**: with thousands of torrents, parsing per keystroke over the whole list
  could stutter. Mitigated by compiling the AST once per change and by the existing known gap (no virtualization)
  bounding the realistic list size.
- **Discoverability of a text language**: mitigated by the filter builder, the completion source and the
  reference card (shipped in the next change) — the user never has to type the syntax to use it.

## Migration Plan

1. Server loads `state.json` v2, writes v3: tabs gain `query`/`pinned`/`group`, assignments become tags.
2. `GET /tabs` returns the new shape; `PUT /torrents/{id}/tab` returns 410 with a message pointing at
   `PUT /torrents/{id}/tags`; `Torrent.tabId` is removed from the model in the same release.
3. The UI reads tabs, parses each query, and renders the sidebar. A tab whose query fails to parse is listed with
   an error badge and is not evaluated.

## Open Questions

- Should `tag:` autocomplete offer tags that exist on no torrent (orphans after a removal)? Current assumption:
  yes, until the user deletes them, so a tab built on a tag does not silently lose its completion.
