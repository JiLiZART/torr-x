## MODIFIED Requirements

### Requirement: Persistent user tabs
The server SHALL persist tabs as saved queries — `id`, `name`, `query` (the canonical query text), `order`,
`pinned` and an optional `group` name — in its state directory, surviving server restarts and engine switches.
A tab SHALL NOT hold a list of torrent ids; its contents SHALL be derived by evaluating its query. The server
SHALL store the query text verbatim, without validating it, together with the grammar version it was written
against. When no tabs exist, the server SHALL seed `All` (empty query, pinned), `Downloading`
(`state:downloading`, pinned) and `Completed` (`progress:100`), which are afterwards ordinary tabs that the user
can rename, reorder, unpin or delete.

#### Scenario: Survives restart
- **WHEN** a tab "4K" with the query `state:active tag:4k sort:ratio desc` exists and the server restarts
- **THEN** `GET /api/v1/tabs` returns "4K" with the same query, order, pinned flag and group

#### Scenario: Contents follow the query
- **WHEN** a torrent gains the tag `4k` while the tab "4K" is open
- **THEN** it appears in that tab at the next refresh without anyone assigning it

#### Scenario: Unparseable query round-trips
- **WHEN** a stored tab's query cannot be parsed by the current grammar
- **THEN** `GET /api/v1/tabs` still returns it unchanged and the UI marks the tab as broken instead of listing
  every torrent

### Requirement: Tab lifecycle
Creating a tab SHALL require a non-empty name after trimming (the UI supplies a name derived from the query, or
"Tab N" for an empty one) and SHALL accept a query, a pinned flag and a group. Deleting a tab SHALL NOT change
any torrent. Tabs SHALL be reorderable, and pinning SHALL only affect presentation order and grouping.
Duplicating a tab SHALL copy its query. Removing a torrent SHALL NOT require any tab bookkeeping.

#### Scenario: Delete tab
- **WHEN** a tab whose query matches twelve torrents is deleted
- **THEN** those twelve torrents are untouched and still listed by any other matching tab

#### Scenario: Blank name rejected
- **WHEN** a client posts a tab named `"   "`
- **THEN** the response is 400 `invalid_input`

#### Scenario: Reorder persists
- **WHEN** the user drags "Seeding" above "Downloading"
- **THEN** the new order is returned by `GET /api/v1/tabs` after a reload

## ADDED Requirements

### Requirement: Migration from membership tabs
On loading a state file written before tabs became queries, the server SHALL convert every torrent-to-tab
assignment into a tag named after that tab (trimmed, lowercased, spaces replaced by `-`), set each affected
tab's query to `tag:<that tag>`, and drop the assignment map. Tabs that had no assignments SHALL be kept with an
empty query. The converted state SHALL be written back once, so the conversion runs only on the first load.

#### Scenario: Assignment becomes a tag
- **WHEN** a pre-migration state file has a tab "Linux ISOs" with two assigned torrents
- **THEN** after loading, both torrents carry the tag `linux-isos`, the tab's query is `tag:linux-isos`, and the
  tab lists the same two torrents
