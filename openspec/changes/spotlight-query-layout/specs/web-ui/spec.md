## MODIFIED Requirements

### Requirement: One palette surface
`⌘T` SHALL open a single centered panel over a dimmed, blurred window that serves as jump surface, filter
entry and command palette. Plain text SHALL rank jump targets (tabs and torrents, with a pinned "All
torrents" entry always available) and SHALL NOT filter the list until the user chooses a filter result or
presses `⇥`. Input that parses as a structured query SHALL switch the panel to grouped sections. Outside query
mode the footer SHALL show `↑↓ navigate · ⏎ run · ⇥ switch section · ⌘K shortcut sheet · esc dismiss`; in query
mode it SHALL show `↑↓ navigate · ⏎ open · ⌘S save as tab · ⇧⏎ show all · ⇥ lens · esc dismiss`. Escape SHALL
dismiss and restore focus.

#### Scenario: Plain text jumps, never filters
- **WHEN** the user types `ubuntu` and presses `⏎` on the torrent result
- **THEN** the app navigates to that torrent and the list's lens is unchanged

#### Scenario: Query engages grouped mode
- **WHEN** the user types `state:paused`
- **THEN** the panel shows the grouped sections without any extra keypress

#### Scenario: Query-mode footer
- **WHEN** the input parses as a structured query
- **THEN** the footer reads `↑↓ navigate · ⏎ open · ⌘S save as tab · ⇧⏎ show all · ⇥ lens · esc dismiss`

### Requirement: Grouped sections never mix
In query mode the panel SHALL show, in order: CREATE TAB FROM THIS QUERY (marked "recommended"), FILTER RESULTS ·
ALL TORRENTS (with the match count), JUMP TO (with the number of name matches; omitted when empty) and ACTIONS
(labelled "apply to the N matches"). FILTER RESULTS SHALL list the first 3 torrents of the whole library that match
the query, each with its size, ratio, tracker and state, followed by a "Show all N matches" row. JUMP TO SHALL list
tabs whose name or query contains one of the query's values, or whose query contains or is contained in the typed
query, and files whose names contain one of the query's values, each file naming its torrent. Registered
selection, tab and global commands SHALL NOT appear in query mode. `↑↓` SHALL move through all rows across
sections, and the cursor SHALL start on the first matching torrent, or on the first row when nothing matches. `⏎`
on a torrent SHALL open it; `⏎` on a tab SHALL activate it; `⏎` on a file SHALL open that torrent's Files section
with the file in view.

#### Scenario: Scope labels as drawn
- **WHEN** the query is `state:active tag:4k size:>4GB sort:ratio` and 41 of 312 torrents match
- **THEN** the panel shows CREATE TAB FROM THIS QUERY "recommended", then FILTER RESULTS · ALL TORRENTS "41
  matches" with 3 torrent rows and "Show all 41 matches · ⇧⏎", then JUMP TO, then ACTIONS "apply to the 41
  matches" with "Pause all matches · ⌘P" and "Add tag to all matches… · ⌘L"

#### Scenario: Torrent opens
- **WHEN** the user presses `⏎` right after typing the query
- **THEN** the app navigates to the first matching torrent and the list's lens is unchanged

#### Scenario: File jump
- **WHEN** a file named `ratio-watchlist.txt` exists in a torrent and the query contains the value `ratio`
- **THEN** JUMP TO lists `ratio-watchlist.txt` with the name of its torrent

#### Scenario: No selection
- **WHEN** the query is `state:paused`, with or without a torrent selected
- **THEN** "Pause selected torrent", "Pause all in this tab" and "Pause everything" are not listed

### Requirement: Palette filter results are lens applications
In query mode, `⇥` SHALL apply the parsed query as a lens in the active tab, and the "Show all N matches" row
(`⇧⏎` or click) SHALL activate the pinned All tab and apply the same lens. Applying SHALL close the panel and
render the lens as chips in the filter bar. Neither SHALL create or modify a sidebar tab.

#### Scenario: Apply as lens
- **WHEN** the query is `state:paused` with tab Active open and the user presses `⇥`
- **THEN** the Active tab shows its paused rows and a `state:paused` chip, and the sidebar is unchanged

#### Scenario: Global escape hatch
- **WHEN** the user presses `⇧⏎` or clicks "Show all N matches"
- **THEN** the All tab becomes active with the same lens applied

### Requirement: Create tab from the palette
The CREATE TAB FROM THIS QUERY section SHALL contain exactly one highlighted result — "Save as smart tab" (`⌘S`) —
with an editable tab name prefilled from the values of the query's `field:value` predicates (no comparisons, ranges
or `sort:`), joined with ` · `. It SHALL be the only palette result that writes to the sidebar. The tab SHALL be
created with the query and the name shown; an empty name SHALL mean the tab is named by its query. Creating SHALL
NOT activate the new tab or change the current lens. When a tab with the same query already exists, the row SHALL
name that tab and running it SHALL activate it instead of creating another.

#### Scenario: Prefilled name
- **WHEN** the query is `state:active tag:4k size:>4GB sort:ratio`
- **THEN** the name field reads `active · 4k`

#### Scenario: Only write path
- **WHEN** the user presses `⌘S` for `state:paused`
- **THEN** a smart tab named `paused` appears in the sidebar, and the current tab and lens stay as they were

#### Scenario: Name cleared
- **WHEN** the user clears the name field and runs the result
- **THEN** the new tab is named by its query

## ADDED Requirements

### Requirement: Query tokens in the palette input
While the palette input parses as a structured query, every `field:value` predicate in it SHALL be drawn as a
token inside the input, with the field and the value styled apart. Text that is not a predicate SHALL be drawn
plain. Typing, the caret, selection and deletion SHALL behave as in a plain text input.

#### Scenario: Tokens while typing
- **WHEN** the user types `state:active tag:4k`
- **THEN** the input shows two tokens, `state:` `active` and `tag:` `4k`, and the caret stays after `4k`

### Requirement: Match-scoped palette actions
In query mode the ACTIONS section SHALL offer "Pause all matches" (`⌘P`) and "Add tag to all matches…" (`⌘L`),
acting on every torrent in the library that matches the query. These keys SHALL apply only while the palette is
open and SHALL NOT trigger their global bindings. Pausing SHALL close the panel and pause each matching torrent
that is not paused. Adding a tag SHALL close the panel and open the tag dialog for the matching torrents. Both SHALL
be disabled with a reason when nothing matches.

#### Scenario: Pause matches
- **WHEN** 41 torrents match and the user presses `⌘P` in the palette
- **THEN** the panel closes and those 41 torrents end up paused; the lens and the active tab are unchanged

#### Scenario: Tag matches
- **WHEN** the user presses `⌘L` in the palette
- **THEN** the panel closes and the tag dialog opens for the matching torrents

#### Scenario: Nothing matches
- **WHEN** the query matches no torrent
- **THEN** both actions are disabled with the reason that nothing matches
