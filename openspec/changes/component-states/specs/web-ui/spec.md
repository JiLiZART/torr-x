## ADDED Requirements

### Requirement: Query chip states
The query chip SHALL be one component used identically in the filter bar, builder preview, palette, terminal
and add flow, with these states: default (`state:`), active/applied (`tag:4k` highlighted), sort
(`sort:ratio desc`, visually distinct), dragging during reorder, negated (`!tracker:tracker.xyz`), invalid
(parser error, e.g. `statu:active`, with the error on hover/focus), overflow, and hover (a visible remove
target). Overflow SHALL wrap to another line; "+N more" SHALL appear only in fixed-width contexts and SHALL
open the full list.

#### Scenario: Invalid chip
- **WHEN** the user enters `statu:active`
- **THEN** the chip renders in the invalid state and its tooltip carries the parser message and suggestion

#### Scenario: Wrap, don't hide
- **WHEN** the lens has more chips than fit on one line of the filter bar
- **THEN** the chips wrap to a second line and none is hidden

### Requirement: Funnel button states
The funnel button SHALL show the lens predicate count (sort excluded) and these states: none (0), some (e.g.
2), active with the builder popover open, and invalid (`!`) when the lens text does not parse.

#### Scenario: Invalid funnel
- **WHEN** the lens contains an unparseable fragment
- **THEN** the funnel shows `!` instead of a count

### Requirement: Sidebar tab states
A sidebar tab SHALL render these states: ad-hoc (named by its query, with count), active, pinned, active with
a lens badge, dragging/reorder, inline rename, group header (e.g. MEDIA), and an unsaved-lens prompt row
"Save lens as tab ⌘S" shown when a lens exists. A tab with an active lens SHALL show its badge in every
state, so it is visible which tab is filtered before switching to it.

#### Scenario: Badge visible when inactive
- **WHEN** the user switches away from a tab that has a two-predicate lens
- **THEN** the lens snapshot badge remains visible on that tab for the session

### Requirement: Terminal output row kinds
Terminal output SHALL be composed only of these row kinds: human (aligned table with monospace columns),
`--json`, error (message with a caret under the failing column and a suggestion), clickable torrent reference
(opens the detail view in place), destructive confirm ("`rm --force` deletes data · ⌘⏎ to confirm"),
policy-blocked ("shell disabled — enable in Settings › Security"), pager (`312 rows · showing 1–50` with
`[space] next page [q] quit [/] search`) and running (`⠼ streaming · ⌃C to stop`).

#### Scenario: Error row
- **WHEN** the user runs `ls statu:active`
- **THEN** an error row shows `unknown field "statu" at col 4` with a caret under it and "did you mean state?"

### Requirement: Torrent row states and hover actions
The torrent row's state dot and badge color SHALL be the single source of state truth for downloading,
seeding, stalled, checking, paused, queued and error, and every surface showing a state SHALL use the same
mapping. On hover or keyboard focus the row SHALL reveal quick actions that replace the TAGS and TRACKER cells
and SHALL NOT cover or shift any data column.

#### Scenario: Hover keeps data
- **WHEN** the pointer enters a row
- **THEN** quick actions appear in place of tags and tracker, and size, progress, rates, peers and ratio do
  not move

### Requirement: System states for every data surface
Every data surface SHALL implement four states: loading, empty (nothing here yet), zero-after-filter and
error, as follows:
- Tab view: loading = skeleton rows with chips visible; empty = "This tab has no torrents yet" with Add;
  zero-after-filter = lens breakdown with Clear lens; error = engine unavailable with Retry, query kept.
- Palette: loading = inline spinner in the input row; empty = recent and pinned All only; zero = "no match —
  create a tab from it?"; error = parser error under the input with the caret at the column.
- Add flow: loading = shimmer on the header with the files tab disabled; empty = metadata only, add anyway;
  zero = file lens cleared with one click; error = timeout, duplicate or unreadable file.
- Detail sections: loading = per-section skeleton; empty = e.g. "no peers connected yet"; zero = section lens
  breakdown; error = section-scoped error while other sections stay.
- Terminal: loading = streaming indicator; empty = empty scrollback with a hint line; zero = "0 rows" with the
  parsed query echoed; error = error line with caret and suggestion.
- Sidebar: loading = skeleton tab labels; empty = "No tabs yet — ⌘T to create one"; zero = not applicable, the
  sidebar is never filtered; error = a sync error badge on the affected tab.
A loading list SHALL show skeleton rows and never a spinner over the whole list; an error SHALL keep the
user's query visible.

#### Scenario: Skeleton keeps chips
- **WHEN** the list is loading after a tab switch
- **THEN** skeleton rows render and the chip row and filter bar stay visible

#### Scenario: Section-scoped error
- **WHEN** the trackers request fails while peers loaded
- **THEN** only the Trackers section shows the error; Peers and Files are unaffected

#### Scenario: Never a generic empty
- **WHEN** a list is empty because of a filter
- **THEN** the empty state names the predicate responsible; a bare "No results" never appears
