## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`): `command-palette.html` (08);
  `spotlight.html` (02, plain-text jump); `spotlight-query.html` (03, structured query);
  `spotlight-light.html` (13, light); `keymap.html` (board F). Read it for layout, spacing and copy; each
  element carries its canvas name in `data-pencil-name`. Colors there are resolved hex values: map them back
  to theme tokens, never copy the hex. Boards G and H have no export; use `pen/untitled.pen` for those.
- Source of truth: screen 08 (`x8HOA5`), with screens 02 (plain-text jump) and 03 (structured query) as the
  two input modes of the same panel; board F (keyboard map), board H (cross-surface contract).
- `active-tab-screen` provides the shell, the ⌘T trigger in the sidebar, tabs-as-queries, the lens and
  `@torrentx/query`.
- Current code has no command abstraction: actions are inline handlers in components.

## Goals / Non-Goals

**Goals:** one surface for jump/filter/act; sections that never mix kinds; every GUI command reachable and
keyed; plain text that never silently filters; the sidebar touched only by the explicit Create-tab result.

**Non-Goals:** the Add Torrent expansion of the panel (screen 04, separate change); terminal commands
(terminal change registers into the same registry later); fuzzy matching beyond substring + rank heuristics;
mouse-first affordances.

## Decisions

1. **Mode detection is the parser.** On each keystroke: try `parse(input)`. Plain text → jump mode (rank
   tabs and torrents by name match). A parseable query with at least one predicate → grouped mode (ACTIONS /
   FILTER / JUMP TO / CREATE TAB). A parse *error* keeps jump mode and shows nothing about filtering — no
   error spam while typing words.
2. **Command registry is the single source.** `lib/commands.ts`: `{id, label, icon, scope:
   "selection"|"tab"|"global", keys, enabled(ctx), run(ctx)}`. The palette lists commands whose label matches
   the input (in query mode: all commands, since the query is not their argument); the shortcut sheet and
   global hotkeys read the same registry. A GUI action without a registry entry is a lint-level bug —
   a test enumerates rendered action buttons against the registry.
3. **Scope is enforced, not suggested.** Selection commands are disabled (with reason) when nothing is
   selected; tab commands name the active tab in their label ("Pause all in this tab · Active"); global
   commands say `global`. Running a tab/global command that affects >1 torrent uses the existing
   destructive-confirm pattern when data is deleted.
4. **Filter results are lens applications.** `⇥` or click applies the query as the active tab's lens and
   closes the panel; `⇧⏎` on the All variant activates the pinned All tab first, then applies. The result
   row shows the live match count ("6 matches") computed with the evaluator. Neither writes a tab.
5. **Create tab is one highlighted row** in its own section, `⌘S`, prefilled name from the query; it
   creates the tab without activating it (board G: the palette never steals focus from the current view).
6. **Ranking**: jump mode — pinned tabs first, then name-prefix matches, then substring; torrents show a
   context line (state · progress · tracker). Query mode — section order fixed as drawn; within JUMP TO,
   tabs before torrents. `⇥` cycles sections, `↑↓` wraps within a section.
7. **Panel chrome**: centered, fixed width 720 px, backdrop blur 14 px, max height ~60% of the window with internal scroll;
   scrim dims and blurs the shell; `esc` dismisses restoring focus to the previous element; footer always
   shows `↑↓ navigate · ⏎ run · ⇥ switch section · ⌘K shortcut sheet · esc dismiss`.

## Risks / Trade-offs

- **"Every command" grows the list unboundedly.** → In query mode ACTIONS shows only commands matching the
  typed words when there are any, else the scoped defaults; the section scrolls, never the panel.
- **Palette becomes a second filter bar.** → Filter results require an explicit choice; plain text never
  filters; the lens chips remain the visible truth of what is applied.
- **Hotkey collisions with the terminal/browser.** → The keymap module owns all bindings, ignores events
  from inputs outside the palette, and `⌘K` opens the sheet instead of any browser default.
