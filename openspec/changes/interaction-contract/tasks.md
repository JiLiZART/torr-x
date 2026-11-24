## 1. Motion and anatomy

- [ ] 1.1 Motion tokens (durations, stagger, expo ease) with reduced-motion collapse; verify tokens used by
      palette, drawer and chip-row fade only
- [ ] 1.2 Shell dimensions (sidebar 248, drawer overlays main only) and palette anatomy (720 px, blur 14 px,
      add-file button, parse strip only when parseable); verify against boards C and G
- [ ] 1.3 Palette add-mode transform: pinned top edge, 240 ms to 860 px, header → files tab → 18 ms row
      stagger (capped), toast collapse, 1.2 s row highlight; verify the input never remounts or moves

## 2. Flows and edge cases

- [ ] 2.1 Add edge cases: metadata timeout "add anyway", duplicate hash "already in <tab>" + Jump, batch drop
      summary with collapsible groups, window-wide drag opens add mode; verify each manually
- [ ] 2.2 Save-as-tab flow: inline confirm, accent flash, lens cleared, 5 s undo, focus rules by origin,
      duplicate/empty/unparseable edges; verify undo restores the lens exactly
- [ ] 2.3 Lens lifecycle: in-memory snapshot, 120 ms fade, read-only tab predicates, 8 s restore pill for ≥2
      predicates, dropped on app close, mid-keystroke commit, deleted-tab fallback toast; verify each
- [ ] 2.4 Terminal open/close timings and rules (180 ms, remembered layout, esc/⌃`, streaming survives,
      pager at 1,000 lines); verify with `terminal-drawer`

## 3. Recovery state

- [ ] 3.1 Culprit-predicate search (largest match reported) and `RecoveryEmptyState` with two labelled chip
      rows and four ordered actions; "Edit this tab's query" when no lens; engine-error precedence; verify
      with `size:>100GB` on the sample library and status bar "0 of 312 — tab query returns 41"

## 4. Contract tests

- [ ] 4.1 `contract.test.ts`: assert each anti-pattern (no sort without chip, chips visible with collapsed
      bar, sidebar unchanged by lens operations, homogeneous palette sections with no destructive first row,
      plain text never filters, lens not across tabs, detail is a routed page, no destructive on bare Enter,
      empty lists name a cause); verify `pnpm test` runs it
- [ ] 4.2 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass and i18n keys exist in six dictionaries
