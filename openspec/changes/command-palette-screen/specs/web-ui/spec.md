## ADDED Requirements

### Requirement: One palette surface
`⌘T` SHALL open a single centered panel over a dimmed, blurred window that serves as jump surface, filter
entry and command palette. Plain text SHALL rank jump targets (tabs and torrents, with a pinned "All
torrents" entry always available) and SHALL NOT filter the list until the user chooses a filter result or
presses `⇥`. Input that parses as a structured query SHALL switch the panel to grouped sections. The footer
SHALL show `↑↓ navigate · ⏎ run · ⇥ switch section · ⌘K shortcut sheet · esc dismiss`; Escape SHALL dismiss
and restore focus.

#### Scenario: Plain text jumps, never filters
- **WHEN** the user types `ubuntu` and presses `⏎` on the torrent result
- **THEN** the app navigates to that torrent and the list's lens is unchanged

#### Scenario: Query engages grouped mode
- **WHEN** the user types `state:paused`
- **THEN** the panel shows the grouped sections without any extra keypress

### Requirement: Grouped sections never mix
In query mode the panel SHALL show, in order: ACTIONS (registered GUI commands with icon, scope label and
keybinding), FILTER (the query as a lens application), JUMP TO (matching tabs and torrents with context
lines), CREATE TAB (save the query as a smart tab). Actions and filters SHALL never appear inside one
section. Selection-scoped commands SHALL be disabled with a reason when nothing is selected; tab-scoped
commands SHALL name the active tab.

#### Scenario: Scope labels as drawn
- **WHEN** the query is `state:paused` with a torrent selected in tab Active
- **THEN** ACTIONS shows "Pause selected torrent · selection · Space", "Pause all in this tab · tab ·
  Active · ⌘⇧P", "Pause everything · global · ⌘⌥P" and "Resume paused in this tab · ⌘⇧R"

#### Scenario: No selection
- **WHEN** nothing is selected
- **THEN** "Pause selected torrent" is disabled with the reason, and the other commands remain available

### Requirement: Palette filter results are lens applications
The FILTER section SHALL offer the parsed query as a lens in the active tab with its live match count,
applied with `⇥` or click, and a variant "in All torrents" (`⇧⏎`) that activates the pinned All tab and
applies the same lens. Applying SHALL close the panel and render the lens as chips in the filter bar.
Neither variant SHALL create or modify a sidebar tab.

#### Scenario: Apply as lens
- **WHEN** the user presses `⇥` on `state:paused · lens · tab “Active” · 6 matches`
- **THEN** the Active tab shows 6 rows and a `state:paused` chip, and the sidebar is unchanged

#### Scenario: Global escape hatch
- **WHEN** the user presses `⇧⏎` on the All-torrents variant
- **THEN** the All tab becomes active with the same lens applied

### Requirement: Create tab from the palette
The CREATE TAB section SHALL contain exactly one highlighted result — `Save “<query>” as a smart tab`
(`⌘S`) — and it SHALL be the only palette result that writes to the sidebar. Creating SHALL NOT activate the
new tab or change the current lens.

#### Scenario: Only write path
- **WHEN** the user runs the Create-tab result for `state:paused`
- **THEN** a smart tab named from the query appears in the sidebar, the current tab and lens stay as they
  were

### Requirement: Command registry and shortcut sheet
Every GUI command SHALL exist in one command registry with id, label, icon, scope, keybinding and run
function; the palette, global hotkeys and the `⌘K` shortcut sheet SHALL all read that registry. The shortcut
sheet SHALL list each command's keybinding and scope.

#### Scenario: Completeness
- **WHEN** any action button renders in the GUI
- **THEN** a corresponding registry entry exists (enforced by test)

#### Scenario: Shortcut sheet
- **WHEN** the user presses `⌘K`
- **THEN** the sheet lists the commands grouped by scope with their keys

### Requirement: Keyboard map
Every surface SHALL be operable without a mouse. The UI SHALL provide at least: open the palette; jump to the
nth sidebar tab; next and previous tab; new tab; save the lens as a tab; rename the active tab; collapse the
sidebar; focus the filter input; open the filter builder; clear the lens; undo the last chip change; move the
row cursor, extend the selection and select all rows the lens shows; open the selected torrent; pause or
resume the selection; remove with confirmation; add a tag to the selection; back and forward; open settings.
The shortcut sheet SHALL list every binding grouped by surface with its scope, and SHALL show the bindings
that work in the current environment (the platform's modifier keys, and the fallback where a browser reserves
the desktop binding). A shortcut SHALL NOT fire while the user is typing in a text field unless it uses a
modifier.

#### Scenario: Shortcut sheet groups
- **WHEN** the user opens the shortcut sheet
- **THEN** it lists the bindings by group — palette, tabs, lens, list, navigation — each with its scope

#### Scenario: Platform modifiers
- **WHEN** the UI runs on Windows or Linux
- **THEN** the sheet and every keybinding hint show Ctrl and Alt rather than ⌘ and ⌥

#### Scenario: Typing guard
- **WHEN** the user types `p` in the filter input
- **THEN** no pause shortcut fires
