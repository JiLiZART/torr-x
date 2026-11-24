## MODIFIED Requirements

### Requirement: Torrent list with live refresh
The UI SHALL show, for the active tab, every torrent matching the tab's query ANDed with the current lens,
ordered by the query's `sort:` predicate, in the columns NAME, SIZE, PROGRESS, DOWN, UP, PEERS, RATIO, STATE,
TAGS, TRACKER. Rows SHALL have one fixed height: a two-line name cell (name clamped with full-name tooltip;
secondary line = tracker · added age, replaced by the state reason while checking, paused or errored), size,
progress bar + percent (or `done`), down/up rates with arrows (or `—` when idle), peer count, ratio, the state
word in its state color, up to two tag chips, and the short tracker name. Numeric cells SHALL never wrap.
The list SHALL refresh at least every 2 seconds while visible with no layout shift. Column headers SHALL edit
the `sort:` chip; no other ordering control may exist. When nothing matches, a zero-results state SHALL name
the tab query, the lens and the responsible predicate, with Clear lens / remove predicate recovery. The
terminal look (green-on-black, monospace) SHALL be kept via theme tokens in both modes. When the API returns
`engine_unavailable`, the UI SHALL show a visible banner with the error and a link to settings instead of an
unexplained empty list.

#### Scenario: Live progress
- **WHEN** a torrent is downloading
- **THEN** its progress and rates update in place without a page reload and no row changes height or position

#### Scenario: State reason in the row
- **WHEN** a torrent is paused by the user
- **THEN** its secondary line reads "paused by user" instead of tracker · added age

#### Scenario: Sorting goes through the query
- **WHEN** the user clicks the SIZE header twice
- **THEN** the chip row shows `sort:size asc` and the list orders by size ascending

#### Scenario: Engine unavailable
- **WHEN** the API returns `engine_unavailable`
- **THEN** the UI shows a visible banner with the error message and a link to settings, instead of an empty
  list with no explanation

## ADDED Requirements

### Requirement: Shell chrome
The window SHALL be a browser-style shell: a left sidebar (collapse control, "Search or paste magnet ⌘T"
trigger, PINNED / SMART TABS / AD-HOC tab sections with live counts and lens badges, collapsible groups,
`+ New tab ⌘⇧T`, `Save current lens as tab ⌘S`, and total down/up transfer rates at the bottom); a top bar
(back/forward, the active tab title with a `lens · N filters` badge and "scoped to this tab" caption when a
lens is active, and density / terminal / settings / account controls); and a status bar (`N of M torrents
match this tab + lens`, the engine name with its state, free space of the download volume, and a collapsed
terminal handle with its shortcut). Total down/up rates SHALL sit at the foot of the sidebar, with session
ratio, server CPU % and memory reachable from there. Window controls SHALL render only in the desktop app.

#### Scenario: Lens badge
- **WHEN** the active tab has three lens predicates
- **THEN** the top bar shows `lens · 3 filters` and the sidebar tab shows its funnel badge

#### Scenario: Match count
- **WHEN** 9 of 312 torrents match the tab query plus lens
- **THEN** the status bar reads "9 of 312 torrents match this tab + lens"

### Requirement: Filter bar and lens chips
Each tab SHALL have a filter bar under the top bar: a fuzzy name input, a funnel button with the predicate
count, an always-visible wrapping chip row rendered from the lens AST (including the sort chip), `+ filter`,
`Save as tab`, and a collapse control that keeps the chips visible. The lens SHALL be ephemeral and per-tab:
ANDed onto the tab query, cleared when switching tabs (with a session snapshot and a `restore lens` pill on
return), undoable with ⌘Z, and never written to the sidebar. Chips SHALL be removable, negatable with
⌥-click, and navigable with ←/→/⌫.

#### Scenario: Chips as drawn
- **WHEN** the lens is `state:active tag:4k size:>4GB sort:ratio desc`
- **THEN** four chips render in that order, the sort chip visually distinct, and the funnel reads 3

#### Scenario: Tab switch clears the lens
- **WHEN** the user switches tabs and returns
- **THEN** the lens is gone and a `restore lens` pill offers it back

#### Scenario: Filtering never mutates the sidebar
- **WHEN** the user types, chips, negates or clears any lens
- **THEN** no sidebar tab is created, renamed or reordered

### Requirement: Filter builder
The funnel button SHALL open a popover that edits the lens as structured rows: each row is a field selector,
an operator selector and a value input, rows joined by a selectable ALL (AND) or ANY (OR), with one nested OR
group supported. The popover SHALL include a sort row, a live preview of the resulting query text with a copy
action, an "Apply lens" action and a "Save as tab" action. Applying predicates built here SHALL produce exactly
the chips that typing the equivalent query produces.

#### Scenario: Build an OR group
- **WHEN** the user adds an ANY group with two tracker rows and applies it
- **THEN** the preview reads `(tracker:a.example OR tracker:b.example)` and the chip row shows the same group

#### Scenario: Builder and text agree
- **WHEN** the user builds `state:active tag:4k size:>4GB sort:ratio desc` in the popover
- **THEN** the chips are identical to those produced by typing that text into the filter bar

### Requirement: Save as tab
Wherever a query exists — the filter bar, the filter builder, the palette and the terminal — the UI SHALL
offer "Save as tab". It SHALL confirm inline (not in a dialog) with an editable name pre-filled from the query
and the query text shown, SHALL create the tab in the active group or the ad-hoc section, SHALL clear the lens
that produced it, and SHALL be undoable for a few seconds. Saving a query identical to an existing tab's SHALL
offer to jump to that tab instead of creating a duplicate. Dismissing the proposal SHALL leave the lens
applied and the sidebar unchanged.

#### Scenario: Save from the filter bar
- **WHEN** the user applies two predicates and chooses "Save as tab", names it "4K active" and confirms
- **THEN** a tab "4K active" with that query appears in the sidebar, the lens is cleared and the new tab lists
  the same torrents

#### Scenario: Duplicate query
- **WHEN** the user saves a query that an existing tab already holds
- **THEN** the UI offers to jump to that tab instead of creating a second one

### Requirement: Navigation history
Every view the user can reach — a tab, and later a torrent page or a settings section — SHALL have its own
address, so that the browser's or the top bar's back and forward move between them and reloading or opening
the address shows the same view. An address SHALL NOT carry a lens. An address naming a tab or torrent that no
longer exists SHALL open the pinned "All" tab and say why.

#### Scenario: Back and forward
- **WHEN** the user opens tab "Seeding", then tab "Active", then presses back
- **THEN** "Seeding" is shown, and forward returns to "Active"

#### Scenario: Reload keeps the view
- **WHEN** the user reloads while tab "4K Movies" is active
- **THEN** "4K Movies" is active after the reload, without any lens

#### Scenario: Stale address
- **WHEN** an address names a tab that was deleted
- **THEN** the "All" tab is shown with a notice that the tab no longer exists

### Requirement: Window controls
Inside the desktop window, red, yellow and green dots at the top of the sidebar SHALL close (hide to tray),
minimize and toggle maximize the window; the empty areas of the sidebar head and of the top bar SHALL drag the
window, and double-clicking them SHALL toggle maximize; interactive elements SHALL NOT start a drag. While the
sidebar is collapsed the dots SHALL move into the top bar. In a plain browser the dots SHALL NOT be rendered.

#### Scenario: Drag window
- **WHEN** the user drags the empty area of the top bar
- **THEN** the window moves; clicking the Spotlight trigger does not move it

#### Scenario: No dots in a browser
- **WHEN** the UI is opened in a regular browser tab
- **THEN** no red, yellow or green window dots are shown

#### Scenario: Collapsed sidebar
- **WHEN** the user collapses the sidebar in the desktop window
- **THEN** the window dots are still visible and working, in the top bar
