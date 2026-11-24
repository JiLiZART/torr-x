## 1. Shared components

- [ ] 1.1 `Chip` with kind/status/negated/overflow props and CSS hover; one story per state (default,
      active, sort, dragging, negated, invalid, overflow, hover); verify against board D in dark and light
- [ ] 1.2 `FunnelButton` (none, some, active, invalid `!`), count excludes sort; verify against screen 01
- [ ] 1.3 `SidebarTab` states incl. group header, inline rename, dragging, unsaved-lens prompt row; lens badge
      visible in every state; verify keyboard rename and reorder
- [ ] 1.4 `stateStyle()` single source for state dot/badge, adopted by row, hero, palette and terminal;
      verify no component hard-codes state colors (lint grep)
- [ ] 1.5 `TorrentRow` hover/focus quick actions replacing Tags + Tracker cells; verify no data column shifts

## 2. Terminal row kinds

- [ ] 2.1 Closed union of output rows (human, json, error, ref, confirm, blocked, pager, running) rendered
      per board D; verify a `node --test` over the formatter asserting each kind

## 3. System states

- [ ] 3.1 `Skeleton` and `EmptyState` (`nothing | lens | engine | parse`) components; `systemStates.ts`
      matrix as the single table; verify each surface renders all four cells
- [ ] 3.2 Wire tab view, palette, add flow, detail sections, terminal and sidebar to the matrix; verify
      section-scoped detail errors leave other sections working and errors keep the query
- [ ] 3.3 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; i18n keys in six dictionaries
