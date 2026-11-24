## MODIFIED Requirements

### Requirement: Tab bar
The UI SHALL present tabs as a vertical list in a left sidebar, not as a horizontal bar. Each tab SHALL show its
name, its icon and the number of torrents its query matches, in three sections: pinned tabs, grouped tabs
(collapsible, named groups) and ad-hoc tabs. The sidebar SHALL offer "New tab" and "Save current lens as tab",
and SHALL support activating, renaming in place (F2 or double-click; Enter or blur saves, Escape cancels),
reordering by drag, pinning, grouping and deleting a tab. A tab whose stored query cannot be parsed SHALL be
listed with an error badge, SHALL show the parse error on hover and SHALL list no torrents. Nothing other than an
explicit "Save as tab", rename, reorder, pin, group or delete SHALL change the sidebar — applying a filter SHALL
NOT add, highlight or reorder anything in it.

#### Scenario: Smart tab contents
- **WHEN** the tab "4K" holds the query `state:active tag:4k` and a torrent gains the tag `4k`
- **THEN** that torrent appears in the tab at the next refresh, with no assignment step

#### Scenario: Rename by double-click
- **WHEN** the user double-clicks "Tab 4", types "Movies" and presses Enter
- **THEN** the tab reads "Movies" after reload and its query is unchanged

#### Scenario: Filtering leaves the sidebar alone
- **WHEN** the user applies a lens in the active tab
- **THEN** no tab is created, renamed, reordered or highlighted; only the active tab's badge shows that a lens is
  applied

#### Scenario: Broken tab query
- **WHEN** a tab's stored query is `statu:active`
- **THEN** the tab shows an error badge, lists nothing, and hovering reveals the parse error

### Requirement: Torrent list with live refresh
The UI SHALL show, for the active tab, every torrent matching the tab's query ANDed with the current lens,
ordered by the query's `sort:` predicate. Rows SHALL show name, size, progress (bar + percent), download rate,
upload rate, seeds/peers, ratio, state, tags and tracker, with a state color per row, and SHALL refresh at least
every 2 seconds while the page is visible. Clicking a column header SHALL edit the `sort:` chip rather than hold
its own sort state; the list SHALL have no ordering control that is not a `sort:` predicate. When nothing
matches, the list SHALL show the zero-results state. The UI SHALL keep a monospace treatment for all query text,
ids and numeric values.

#### Scenario: Live progress
- **WHEN** a torrent is downloading
- **THEN** its progress and rates update in the list without a page reload

#### Scenario: Sorting goes through the query
- **WHEN** the user clicks the SIZE header twice
- **THEN** the chip row shows `sort:size asc` and the list is ordered by size ascending

#### Scenario: Engine unavailable
- **WHEN** the API returns `engine_unavailable`
- **THEN** the UI shows a visible banner with the error message and a link to settings, instead of an empty list
  with no explanation

## ADDED Requirements

### Requirement: Filter bar and chips
Every tab SHALL show a filter bar directly under the tab title containing: a fuzzy name input, a funnel button
whose badge is the number of lens predicates (sort included), one chip per lens predicate, an "add filter"
affordance and a "Save as tab" action. Chips SHALL always be visible: they SHALL wrap onto further lines rather
than being hidden, truncated to an icon or moved into the funnel popover, and collapsing the filter bar SHALL
hide only the input and the funnel. Each chip SHALL show its field, operator and value, SHALL be removable, and
SHALL support negation in place. The sort predicate SHALL be rendered as a chip in this row, visually
distinguished from filter chips.

#### Scenario: Chips stay visible
- **WHEN** four lens predicates are applied and the user collapses the filter bar
- **THEN** all four chips plus the sort chip remain on screen

#### Scenario: Chip overflow
- **WHEN** the applied predicates are wider than the filter bar
- **THEN** the chips wrap onto a second line and none is hidden

#### Scenario: Remove a predicate
- **WHEN** the user clicks a chip's remove control
- **THEN** that predicate is dropped, the list updates and the funnel count decreases by one

### Requirement: Lens is scoped to the active tab
A filter applied inside a tab SHALL be a lens: a query ANDed onto that tab's query, affecting only that tab's
list. Switching tabs SHALL clear the visible lens; the UI MAY offer, for the rest of the session, to restore the
lens of a tab the user returns to. A lens SHALL NOT be persisted, SHALL NOT be sent to the server and SHALL NOT
alter the tab's stored query. Global filtering SHALL be reachable only through Spotlight or the pinned "All" tab.

#### Scenario: Lens does not leak
- **WHEN** the user applies `size:>4GB` in "Active" and switches to "Seeding"
- **THEN** "Seeding" shows no chips and lists every torrent its own query matches

#### Scenario: Returning to a tab
- **WHEN** the user returns to "Active" in the same session
- **THEN** the lens is not silently reapplied; the UI offers to restore it

#### Scenario: Reload drops the lens
- **WHEN** the page is reloaded while a lens is applied
- **THEN** the tab opens with its own query only

### Requirement: Filter builder
The funnel button SHALL open a popover that edits the lens as structured rows: each row is a field selector, an
operator selector and a value input, rows are joined by a selectable ALL (AND) or ANY (OR), and one nested OR
group is supported. The popover SHALL include a sort row, a live preview of the resulting query text with a copy
action, an "Apply lens" action and a "Save as tab" action. Applying predicates built here SHALL produce exactly
the chips that typing the equivalent query produces.

#### Scenario: Build an OR group
- **WHEN** the user adds an ANY group with two tracker rows and applies it
- **THEN** the preview reads `(tracker:a.example OR tracker:b.example)` and the chip row shows the same group

#### Scenario: Builder and text agree
- **WHEN** the user builds `state:active tag:4k size:>4GB sort:ratio desc` in the popover
- **THEN** the chips are identical to those produced by typing that text into the filter bar

### Requirement: Save as tab
Wherever a query exists — the filter bar, the filter builder, Spotlight and the terminal — the UI SHALL offer
"Save as tab". It SHALL confirm inline (not in a dialog) with an editable name pre-filled from the query and the
query text shown, SHALL create the tab in the active group or the ad-hoc section, SHALL clear the lens that
produced it, and SHALL be undoable for a few seconds. Saving a query identical to an existing tab's SHALL offer
to jump to that tab instead of creating a duplicate. Dismissing the proposal SHALL leave the lens applied and the
sidebar unchanged.

#### Scenario: Save from the filter bar
- **WHEN** the user applies two predicates and chooses "Save as tab", names it "4K active" and confirms
- **THEN** a tab "4K active" with that query appears in the sidebar, the lens is cleared and the new tab lists
  the same torrents

#### Scenario: Declining the proposal
- **WHEN** the user dismisses the save proposal
- **THEN** no tab is created and the lens stays applied

#### Scenario: Duplicate query
- **WHEN** the user saves a query that an existing tab already holds
- **THEN** the UI offers to jump to that tab instead of creating a second one

### Requirement: Zero-results state
When the active tab plus its lens match nothing, the list SHALL be replaced by a state that explains the cause
rather than reporting "no results": it SHALL render the tab's query and the lens as two separately labelled chip
rows with their match counts, SHALL name the predicate that removes the last remaining torrents, and SHALL offer,
in this order, clear lens, remove that predicate, open the filter builder and search all torrents. The chips, the
funnel count and the status bar counts SHALL stay visible, and the status bar SHALL report both the matched count
and the count the tab query alone returns.

#### Scenario: Lens empties the tab
- **WHEN** the tab query matches 41 torrents and the lens adds `size:>100GB`, which matches none
- **THEN** the empty state names `size:>100GB` as the cause, shows the largest matching size, and offers
  "Clear lens"

#### Scenario: Status bar keeps both numbers
- **WHEN** the list is empty because of the lens
- **THEN** the status bar reads that 0 of the tab's 41 torrents match

#### Scenario: Empty tab without a lens
- **WHEN** the tab's own query matches nothing and no lens is applied
- **THEN** the state offers to edit the tab's query instead of clearing a lens
