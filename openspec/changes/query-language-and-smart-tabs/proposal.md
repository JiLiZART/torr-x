## Why

The canvas design (`pen/untitled.pen`, boards A/D/E and screens 01, 05, 06) reorganizes the product around three
layers that today are conflated: **scope** (a tab), **lens** (an ephemeral filter inside the active tab) and
**query** (one text language both are written in). Today a tab is a bag of torrent ids the user drags rows into,
filtering is a name substring in the header, and sorting is a column-header click — three unrelated mechanisms,
none of which can be saved, shared, typed or explained. The result is the anti-pattern the design calls out:
the user cannot tell why a list is empty, and the only way to "save a filter" is to hand-assign torrents.

This change lands the foundation every other screen of the design depends on: the query language, chips, the
lens, and tabs that are saved queries.

## What Changes

- **Query language** (`state:active tag:4k size:>4GB sort:ratio desc`): one grammar with fields, comparison
  operators, ranges, negation, quoted phrases, `AND`/`OR`, one level of grouping, and `sort:` as an ordinary
  predicate. One parser/evaluator in a new `packages/query`, used by the filter bar, the filter builder, the
  tab definitions and (next change) Spotlight and the terminal. Parse errors carry a column and a suggestion.
- **Tabs become saved queries**: a tab is `{id, name, query, order, pinned, group}`. Built-in All /
  Downloading / Completed become ordinary pinned tabs with queries. Manual membership is gone.
- **Tags replace tab membership**: a torrent can carry many server-stored tags; `tag:` is a query field.
  Existing tab assignments migrate to a tag per tab, and each migrated tab's query becomes `tag:<name>`.
- **Lens**: a per-tab ephemeral query ANDed onto the tab's query. It is rendered as removable chips next to the
  tab title, is never written to the sidebar, and is cleared when the user switches tabs.
- **Filter bar and filter builder**: fuzzy name input, funnel button with a predicate count, always-visible
  chips including the sort chip, and a popover that edits predicates as field/operator/value rows with AND/OR
  groups and a live query preview.
- **Save as tab**: the only action that writes to the sidebar, offered (never forced) wherever a query exists.
- **Zero-results state** that names the tab query, the lens, and the predicate responsible, with one-key recovery.
- **BREAKING (API)**: `Tab` gains `query`, `pinned`, `group` and loses membership semantics; `Torrent.tabId` is
  replaced by `Torrent.tags`; `PUT /torrents/{id}/tab` is replaced by `PUT /torrents/{id}/tags`. Existing
  `state.json` files are migrated on load.

## Capabilities

### New Capabilities
- `torrent-query`: the query language — fields, operators, sort, evaluation and error reporting.
- `torrent-tags`: server-stored, many-per-torrent labels.

### Modified Capabilities
- `torrent-tabs`: a tab is a saved query, not a membership list; pinning, grouping and ordering.
- `http-api`: tab shape, tag endpoints, `Torrent.tags`, state migration.
- `web-ui`: sidebar tab list, filter bar with chips, filter builder, save-as-tab, lens scoping and the
  zero-results state. **Modifies** requirements introduced by `adopt-magic-patterns-ui` ("Tab bar",
  "Torrent list with live refresh").

## Impact

- New `packages/query` (`@torrentx/query`): tokenizer, parser, evaluator, formatter, field registry,
  completion source; pure TS, tested with `node --test` like `packages/ui/src/lib/*.test.ts`.
- `packages/ui`: `TabBar.tsx` replaced by a sidebar tab list, new `FilterBar` / `Chip` / `FilterBuilder`
  components, `TorrentList` filters and sorts through the evaluator instead of its own search/sort state,
  new empty state; i18n keys in all six dictionaries.
- `packages/api-client`: `Tab` shape, `tags` methods, `Torrent.tags`.
- `crates/torrentx-core`: `Torrent.tab_id` → `tags: Vec<String>`; fixture `tests/fixtures/torrent.json` and its
  TS drift check updated together.
- `crates/torrentx-server`: `store.rs` tab records gain `query`/`pinned`/`group`, tag map, v2→v3 migration;
  `api.rs` tab and tag routes.
- No engine changes. Filtering and sorting stay client-side (hundreds of torrents, as today).
- Ordering: archive `adopt-magic-patterns-ui` (and `ui-row-activity-and-window-polish`) before this change, so
  the `web-ui` deltas apply to `openspec/specs/`.
