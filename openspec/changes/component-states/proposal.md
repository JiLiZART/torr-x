## Why

Board D ("Component library — states", `pen/untitled.pen` `C7sgpb`) lists "every state an engineer has to
build", and board H adds the surface × state matrix (loading / empty / zero-after-filter / error). The screen
changes specify the happy path; without this change each engineer would invent the other states, which is
exactly how "No results" defects and silent failures ship. This change turns both boards into acceptance
criteria for the shared components.

## What Changes

- **Query chip**: one component, eight states — default, active (applied), sort, dragging (reorder), negated
  (`!tracker:`), invalid (parser error), overflow (never hide — wrap, with `+3 more` only in constrained
  contexts such as the sidebar badge, not the filter bar), hover (remove target). Used identically in the
  filter bar, builder preview, palette, terminal and add flow.
- **Funnel button**: none (0), some (2), active with popover open, invalid (`!`).
- **Sidebar tab**: ad-hoc, active, pinned, active + lens badge, dragging, inline rename, group header,
  and the unsaved-lens "Save lens as tab ⌘S" prompt row.
- **Terminal output row**: human table, `--json`, error with caret + suggestion, clickable torrent reference,
  destructive confirm, policy-blocked (shell), pager, running/streaming.
- **Torrent row state + hover**: dot + badge color is the single source of state truth for downloading,
  seeding, stalled, checking, paused, queued, error; hover reveals quick actions that replace the TAGS and
  TRACKER columns, never the data columns.
- **System states for every data surface**: loading (skeleton rows, chips stay), empty (nothing here yet),
  empty — lens filtered out (tab query vs lens, names the predicate, Clear lens), error (query kept) — with
  the per-surface matrix: tab view, palette, add flow, detail sections, terminal, sidebar.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: component state requirements and the system-state matrix; **refines** "Filter bar and lens
  chips" (`active-tab-screen`), the terminal output rows (`terminal-drawer`) and the list states
  (`attention-first-list`, `empty-library-and-first-run`).

## Impact

- `packages/ui`: `Chip` (+ stories of each state), `FunnelButton`, `SidebarTab`, `OutputRow` kinds,
  `TorrentRow` hover actions, shared `Skeleton*` and `EmptyState` components with a `kind` prop; i18n keys.
- No API changes.
- Open point: board D says the funnel count includes the sort predicate; screen 01 shows 3 with
  `state tag size` + a sort chip. This change keeps screen 01 (count excludes sort) — see design.
- Depends on `active-tab-screen`, `terminal-drawer`, `empty-library-and-first-run`.
