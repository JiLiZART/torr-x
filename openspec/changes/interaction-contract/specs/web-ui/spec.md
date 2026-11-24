## ADDED Requirements

### Requirement: Scope, lens and query model
The UI SHALL keep three distinct layers: scope (a tab, a persistent saved query in the sidebar), lens (an
ephemeral extra query ANDed onto the active tab, in memory, shown as chips next to the tab title) and query
(the shared text language both are written in). A lens SHALL always scope to the active tab. Global filtering
SHALL be reachable through exactly two doors: `⌘T` and the pinned All tab. The result set SHALL be the tab
query AND the lens, and the terminal SHALL print the same rows the list shows.

#### Scenario: Two doors only
- **WHEN** the user wants to filter across all torrents
- **THEN** the only paths are Spotlight (`⌘T`, or the "in All torrents" variant) and activating the All tab

#### Scenario: Terminal and list agree
- **WHEN** a lens is active and the user runs `ls` with the same query in the terminal
- **THEN** the same rows in the same order are printed

### Requirement: Surface anatomy
The shell SHALL be a 248 px sidebar plus a main area that fills the rest, with the terminal drawer overlaying
the main area only. The sidebar SHALL hold window controls, the Spotlight trigger, PINNED, SMART TABS (with
collapsible groups), AD-HOC, new tab, save current lens as tab, and transfer stats. The main area SHALL hold
the top bar (back/forward, tab title, lens pill, terminal toggle, settings), the filter bar (fuzzy input,
funnel with count, chips including sort, save as tab, collapse), the column header, the list (rows revealing
quick actions on hover) and the status bar (counts and the terminal handle). The palette SHALL hold the
input row (text, magnet or `.torrent` drop, add-file button at the right), a parse strip with chips and
`n of 312` shown only when the query parses, the sections, the pinned All torrents entry and footer hints.
The terminal drawer SHALL have a tab strip (client, logs, shell disabled by policy), split, maximize and close.

#### Scenario: Drawer overlays only the main area
- **WHEN** the terminal drawer opens
- **THEN** the sidebar stays fully visible and interactive and the list is covered, not resized

#### Scenario: Parse strip only when parseable
- **WHEN** the palette input is plain text
- **THEN** no parse strip is shown; when it becomes a parseable query the strip shows the chips and the
  match count

### Requirement: Add flow motion and edge cases
Opening the palette SHALL show a 720 px panel with a 14 px backdrop blur and the caret already in the input.
Entering add mode (magnet, `.torrent` path or file drop) SHALL animate the panel height downward to 860 px in
240 ms with an expo ease-out while the top edge and the input stay in place; the header SHALL fade in first,
then the files tab, then rows SHALL stagger in 18 ms apart. `⌘⏎` SHALL add and start, `⇧⏎` add paused, `esc`
cancel and collapse. On commit the panel SHALL collapse upward into a toast and the new list row SHALL slide in
with a 1.2 s accent highlight. Dragging a file anywhere over the window SHALL open the panel already in add
mode. Edge cases: a metadata timeout (>30 s) SHALL keep the panel open with "still resolving — add anyway?"
and the known name from `dn=`; a duplicate info-hash SHALL switch to an "already in <tab>" state with a Jump
to it button instead of adding; several dropped files SHALL show a batch summary header and one collapsible
group per torrent in the files tab.

#### Scenario: Input never moves
- **WHEN** the panel expands into add mode
- **THEN** the input keeps its position and caret and only the content below grows

#### Scenario: Duplicate
- **WHEN** the dropped torrent's hash already exists in Seeding
- **THEN** the panel says "already in Seeding" with a Jump to it button and offers no add action

#### Scenario: Batch drop
- **WHEN** three `.torrent` files are dropped together
- **THEN** the header shows a batch summary and the files tab lists three collapsible groups

#### Scenario: Commit feedback
- **WHEN** the user adds with `⌘⏎`
- **THEN** the panel collapses into a toast and the new row is highlighted for 1.2 s without changing the
  active tab or its lens

### Requirement: Save as tab flow
Save as tab SHALL be offered by the filter bar, builder footer, palette and terminal, and SHALL confirm
inline (not in a dialog) with a name field pre-filled from the query (e.g. "4K · active"), the query text
underneath and an Enter-to-confirm hint. On confirm the tab SHALL be appended to the active group or to
AD-HOC, its sidebar row SHALL flash the accent colour once, the lens that produced it SHALL be cleared, and
`⌘Z` within 5 seconds SHALL remove the tab and restore the lens exactly. A tab created from the palette SHALL
become active immediately; one created from the terminal SHALL NOT steal focus. Dismissing with `esc` SHALL
leave the lens applied. A duplicate query SHALL offer Jump to the existing tab; an empty name SHALL fall back
to the canonical query string; an unparseable query SHALL disable Save as tab with the parser error as its
tooltip.

#### Scenario: Undo
- **WHEN** the user saves a lens as a tab and presses `⌘Z` 3 seconds later
- **THEN** the tab is gone and the lens is back exactly as before

#### Scenario: Unparseable
- **WHEN** the lens text does not parse
- **THEN** Save as tab is disabled and its tooltip shows the parser error

#### Scenario: Terminal does not steal focus
- **WHEN** the user saves a query from the terminal prompt
- **THEN** the tab appears in the sidebar and the current view and focus are unchanged

### Requirement: Lens lifecycle on tab switch
Leaving a tab SHALL snapshot its lens in memory for the session and clear the visible lens, fading the chip
row out over 120 ms. The newly shown tab SHALL display its own saved predicates as read-only context plus any
lens of its own. Returning within the session SHALL restore the snapshot and, when it had two or more
predicates, offer a one-click "restore lens" pill for 8 seconds. Closing the app SHALL drop every lens. A lens
SHALL NOT survive a tab switch, a deep link or a restart unless saved. If the lens was mid-keystroke the
parsed part SHALL be committed and the trailing fragment dropped. If a tab is deleted while its lens is live,
the UI SHALL fall back to the pinned All tab, drop the lens and explain with a toast.

#### Scenario: Restore pill
- **WHEN** the user leaves a tab with a 3-predicate lens and returns 20 seconds later
- **THEN** the lens is restored and the "restore lens" pill was offered for 8 seconds after returning

#### Scenario: Restart drops lenses
- **WHEN** the app is closed and reopened
- **THEN** no lens is applied on any tab and tabs are exactly as saved

#### Scenario: Deleted tab
- **WHEN** a tab with a live lens is deleted from another window
- **THEN** the All tab is shown, the lens is dropped and a toast explains why

### Requirement: Terminal drawer open and close
The terminal toggle SHALL sit in the top-right cluster of the top bar. Opening SHALL slide the drawer up over
the list in 180 ms with ease-out without resizing or re-sorting the list; the drawer SHALL remember its
height, tab set and split layout. `esc` SHALL return focus to the list leaving the drawer open; `⌃`` SHALL
close it; the status bar handle SHALL show the collapsed state and the same shortcut. Clicking a torrent
reference in output SHALL open its detail view in place with the drawer left open. A command still streaming
when the drawer closes SHALL keep running, with the handle showing a spinner and the live-command count;
output beyond 1,000 lines SHALL open the pager. Dangerous commands SHALL require `⌘⏎` or a typed name, and the
remote shell SHALL be off by default and shown as a visibly disabled tab with a policy explanation.

#### Scenario: Streaming survives closing
- **WHEN** `watch state:downloading` is running and the drawer is closed
- **THEN** the command keeps running and the handle shows a spinner and "1"

### Requirement: Empty-filter recovery
When the active tab query plus lens yields zero rows, the list area SHALL show a state that names the cause:
two separately labelled chip rows (the tab query and the lens), the narrowest predicate whose removal brings
results back with the largest match stated ("`size:>100GB` removes every remaining torrent — largest match is
42.1 GB"), and four recovery actions in order of destructiveness — Clear lens (`⌘⇧K`), Remove that one
predicate (`⌘Z`), Edit in filter builder (`⌥F`), Search all torrents (`⌘T`). The chips, funnel count and
status bar SHALL stay visible, the status bar SHALL report both numbers ("0 of 312 — tab query returns 41"),
the sidebar SHALL be untouched, and the callout SHALL be amber, not an error. When the tab query alone yields
zero (no lens), the first action SHALL be "Edit this tab's query". When the engine is unavailable the engine
error state with Retry SHALL be shown instead, keeping the query intact.

#### Scenario: Culprit named
- **WHEN** the lens is `state:active size:>100GB` on a tab whose query returns 41 torrents
- **THEN** the state calls out `size:>100GB` and the largest match, and the status bar reads "0 of 312 — tab
  query returns 41"

#### Scenario: Tab query itself is empty
- **WHEN** no lens is applied and the tab query matches nothing
- **THEN** the first recovery action is "Edit this tab's query"

#### Scenario: Not an error
- **WHEN** the lens filters everything out
- **THEN** no red or alert styling is used and the sidebar is unchanged

### Requirement: Cross-surface contract
Across every surface: lenses SHALL be per tab and always rendered beside the tab title; Save as tab SHALL be
available from the filter bar, builder, palette and terminal with the same name field, confirm and undo; the
terminal, filter bar, builder, palette and CLI SHALL share one grammar, one error model, one completion
source and one chip renderer so a query copied from any pastes into any other; sort SHALL live only in the
chip row; active filters SHALL always be visible, wrapping to a second line rather than collapsing; every GUI
command SHALL be present in the palette with its keybinding and scope.

#### Scenario: Query portability
- **WHEN** a query is copied from the builder and pasted into the palette
- **THEN** it parses to the same chips

### Requirement: Anti-patterns are defects
The UI SHALL NOT exhibit any of the following, and the test suite SHALL assert each: filter-as-tab (applying a
filter adds, renames, reorders or highlights anything in the sidebar); hidden active filters (a filtered list
with no chips on screen — collapsing the filter bar hides the input and funnel, never the chips); sort outside
the query (sorting column headers without a `sort:` chip, a sort dropdown, or a per-tab sort setting the query
does not know); mixed sections in the palette (actions, jump targets, filter results and tab creation in one
section, or a destructive item first); auto-filtering on `⌘T` (plain text changing the list behind the panel);
lens leaking across tabs; modal torrent details (the detail view is a page with browser back, with no stacked
modals for files or trackers); silent destructive commands (`rm --force`, move-with-overwrite, shell
executing on Enter alone); generic empty states ("No results" with no named predicate or recovery).

#### Scenario: Collapsed filter bar
- **WHEN** the user collapses the filter bar while a lens is active
- **THEN** the input and funnel hide and the chips remain on screen

#### Scenario: Sorting via header
- **WHEN** the user clicks a column header
- **THEN** a `sort:` chip appears or changes; no hidden sort state exists

#### Scenario: Destructive on Enter
- **WHEN** the user types `rm --force state:error` and presses Enter
- **THEN** nothing is deleted; a confirm row asks for `⌘⏎` or the typed name
