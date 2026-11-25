## Why

Screen 01 (`pen/untitled.pen`, `NaQpo` "Active Tab — Lens + Chips (Dark)") is the home surface of the product:
sidebar tabs, filter bar with lens chips, the torrent list and the status bar, all speaking one query
language. Nothing of it exists in code today — the current UI is a horizontal tab strip, a substring search
and a column-sort list. This change implements the screen **from the ground up**, including the foundations it
needs (query language, saved-query tabs, tags, shell chrome), so it can be built without waiting for any
other change.

**Replaces** the pending board-derived change `query-language-and-smart-tabs` (removed) and the shell /
filter-bar portions of `browser-shell-and-spotlight` (trimmed to `add-flow-and-theming`); their non-superseded
requirements (filter builder, save-as-tab, navigation history, window controls) are carried here.
`command-palette-screen` and `torrent-detail-screen` build on this one.

## What Changes

- **Query package** (`packages/query`, `@torrentx/query`): one grammar — `field:value`, `!`, `> < >= <=`,
  `a..b`, quoted phrases, `*` wildcards, implicit AND, `AND`/`OR`, one level of `( )`, `sort:` as a predicate
  with direction. One parser, evaluator, formatter, chip renderer, completion source and error model
  (`{message, column, length, suggestion}`), pure TS with `node --test`.
- **Tabs are saved queries**: `{id, name, query, order, pinned, group}`; built-in All / Downloading / Seeding /
  Stalled / Active are seeded pinned/smart tabs with queries; ad-hoc tabs are named by their query
  (`tracker:xyz · today`). Manual membership is removed; **tags** (many per torrent, server-stored) replace
  it, `tag:` is a query field. `state.json` migrates (assignments → tags, tab queries → `tag:<slug>`).
- **Shell chrome as drawn**: left sidebar — collapse control, "Search or paste magnet ⌘T" trigger, sections
  PINNED / SMART TABS / AD-HOC, per-tab match counts and lens badges, collapsible groups (Media → 4K Movies,
  Shows), `+ New tab ⌘⇧T`, `Save current lens as tab ⌘S`, transfer totals (↓ 42.1 MB/s · ↑ 7.8 MB/s) at the
  bottom. Top bar — back/forward, tab title with `lens · N filters` badge and "scoped to this tab", density,
  terminal, settings, account. Status bar — `9 of 312 torrents match this tab + lens`, `free 1.2 TB`,
  collapsed `Terminal ⌃`` handle.
- **Filter bar + lens**: fuzzy name input (`ubuntu`), funnel with predicate count opening the **filter
  builder** popover (field/operator/value rows, AND/OR + one nested group, sort row, live preview),
  always-visible removable
  chips (`state:active` `tag:4k` `size:>4GB` `sort:ratio desc`), `+ filter`, `Save as tab`, collapse control.
  The lens is per-tab, ephemeral, ANDed onto the tab query, cleared on tab switch, never written to the
  sidebar; `Save as tab` is the only write path.
- **List and row as drawn**: columns NAME · SIZE · PROGRESS · DOWN · UP · PEERS · RATIO · STATE · TAGS ·
  TRACKER; fixed-height rows — name + secondary line (tracker · added age, or the state reason: "verifying
  pieces", "paused by user", "tracker refused"), progress bar + % or `done`, rates with arrows or `—`, state
  word in its color, tag chips, short tracker name. Sorting only via `sort:` chips; column headers edit the
  sort chip. Live refresh ≥ 1 Hz with no layout shift.
- **BREAKING (API)**: `Tab` gains `query/pinned/group`, loses membership; `Torrent.tabId` → `Torrent.tags`;
  `PUT /torrents/{id}/tab` → `PUT /torrents/{id}/tags`.

## Capabilities

### New Capabilities
- `torrent-query`: the shared query language (grammar, fields, sort, errors, completion, chips).
- `torrent-tags`: server-stored many-per-torrent labels.

### Modified Capabilities
- `torrent-tabs`: a tab is a saved query with pin/group/order; sidebar sections.
- `http-api`: tab and tag endpoints, `Torrent.tags`, state migration.
- `web-ui`: shell chrome, filter bar/lens, list and row anatomy. **Modifies** the base "Torrent list with
  live refresh" requirement.

## Impact

- New `packages/query`; `packages/ui`: `Shell`, `Sidebar`, `TopBar`, `StatusBar`, `FilterBar`, `Chip`,
  `TorrentList`, `TorrentRow` (from the `Row / Torrent` component, 14 overridable parts); old `TabBar.tsx`,
  `Header.tsx` removed.
- `crates/torrentx-core`: `Torrent.tags`; drift fixture + `packages/api-client` together.
- `crates/torrentx-server`: `store.rs` tab records + tag map + migration; `api.rs` tab/tag routes.
- i18n keys in six dictionaries; theme tokens (`$ui-*`) only, no literal colors.
- No engine changes. Filtering/sorting client-side (hundreds of torrents).
- Ordering: archive `adopt-magic-patterns-ui` and `ui-row-activity-and-window-polish` first (row height,
  window controls); then this change; then `command-palette-screen`, `torrent-detail-screen`.
