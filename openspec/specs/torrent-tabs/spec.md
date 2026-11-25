# torrent-tabs Specification

## Purpose
A tab is a saved query stored by the server — a persistent scope in the sidebar, identical in every browser and in the desktop window — not a bag of torrent ids.

## Requirements

### Requirement: Tabs are saved queries
A tab SHALL be `{id, name, query, order, pinned, group}`. Its result set SHALL be the torrents matching its
query; manual torrent-to-tab membership SHALL NOT exist. Built-in tabs (All, Downloading, Seeding, Stalled,
Active) SHALL be seeded as ordinary tabs with queries on first run. The server SHALL store query text
verbatim with a grammar version and SHALL NOT reject unparseable queries; the UI SHALL mark such tabs with
an error badge and list nothing for them. Existing membership-based state SHALL migrate: assignments become
tags and each affected tab's query becomes `tag:<slug>`.

#### Scenario: Membership migration
- **WHEN** a v2 state file has torrents assigned to tab "Media"
- **THEN** after migration those torrents carry tag `media` and the tab's query is `tag:media`

#### Scenario: Unparseable tab
- **WHEN** a stored tab query fails to parse
- **THEN** the sidebar shows an error badge with the parse error on hover and the tab lists nothing

### Requirement: Sidebar sections and tab management
The sidebar SHALL render tabs in three sections — PINNED, SMART TABS (grouped, collapsible), AD-HOC — with
live match counts and a lens badge on tabs with an active lens. Tabs SHALL support activate, rename in place
(F2 / double-click), drag reorder, pin/unpin, grouping, and delete with confirmation for non-trivial
queries. Ad-hoc tabs SHALL default their display name to their query text. `Save as tab` SHALL be the only
action that creates a sidebar entry from a lens.

#### Scenario: Sections as drawn
- **WHEN** the library matches screen 01's state
- **THEN** All/Downloading appear under PINNED, Active/Seeding/Stalled and the Media group under SMART TABS,
  and `tracker:xyz · today` under AD-HOC, each with its live count

#### Scenario: Save as tab
- **WHEN** the user presses ⌘S with a 3-predicate lens active
- **THEN** a new ad-hoc tab with that query appears, named from the query, and the lens stays in the old tab
