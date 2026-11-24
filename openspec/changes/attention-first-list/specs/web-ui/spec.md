## MODIFIED Requirements

### Requirement: Torrent list with live refresh
The UI SHALL show, for the active tab, every torrent matching the tab's query ANDed with the current lens,
ordered by the query's `sort:` predicate. Rows SHALL show name, size, progress (bar + percent), download rate,
upload rate, seeds/peers, ratio, state, tags and tracker, with a state color per row, and SHALL refresh at least
every 2 seconds while the page is visible. The state cell SHALL render the server diagnosis as one localized
sentence when present, falling back to the state name. Clicking a column header SHALL edit the `sort:` chip
rather than hold its own sort state; the list SHALL have no ordering control that is not a `sort:` predicate.
When nothing matches, the list SHALL show the zero-results state. The UI SHALL keep a monospace treatment for
all query text, ids and numeric values. The list SHALL render only the visible window of rows (virtualization)
at a fixed row height, so that live updates cause no layout shift and thousands of torrents stay scrollable.
When the API returns `engine_unavailable`, the UI SHALL keep showing the last successfully loaded list,
visibly dimmed, with one banner stating the data's timestamp and that retry is automatic, and SHALL disable
engine-dependent actions with the reason; cached data SHALL NOT survive a page reload.

#### Scenario: Live progress
- **WHEN** a torrent is downloading
- **THEN** its progress and rates update in the list without a page reload and no row changes height or position

#### Scenario: Sorting goes through the query
- **WHEN** the user clicks the SIZE header twice
- **THEN** the chip row shows `sort:size asc` and the list is ordered by size ascending

#### Scenario: Diagnosis in the row
- **WHEN** a torrent's diagnosis is `stalled-no-peers`
- **THEN** its state cell reads the localized sentence (e.g. "stalled — no seeds across 2 trackers"), and the
  detail page shows the same sentence above the numbers

#### Scenario: Engine unavailable
- **WHEN** the API returns `engine_unavailable`
- **THEN** the last good list stays visible, dimmed, with one timestamped banner and automatic retry, and
  pause/resume/remove actions are disabled with the reason — never an empty screen

#### Scenario: Large library
- **WHEN** the library holds 5,000 torrents
- **THEN** scrolling renders only the visible rows plus overscan, and keyboard navigation scrolls the focused
  row into view

## ADDED Requirements

### Requirement: Obligation groups
The list SHALL offer a grouped view that renders the attention classes as four collapsible sections —
needs attention, seeding duty, active, done — each with its name and count. The grouped view SHALL be a
rendering of `sort:attention` (available only when the effective sort begins with `attention`), SHALL NOT
introduce any ordering state of its own, and SHALL respect the active tab query and lens. Attention-class
changes SHALL apply with hysteresis (the new class held for two consecutive polls) so live polling does not
shuffle rows under the pointer.

#### Scenario: Glance answer
- **WHEN** the user opens the All tab with one errored torrent and thirty healthy ones
- **THEN** the "needs attention" group is first, expanded, showing that one torrent with its diagnosis sentence

#### Scenario: Grouping follows the sort
- **WHEN** the user changes the sort to `sort:size`
- **THEN** the grouped view turns off (its toggle disabled with a hint) and the list is a flat size-ordered list

#### Scenario: Lens still applies
- **WHEN** a lens `tag:4k` is active in the grouped view
- **THEN** every group counts and shows only matching torrents
