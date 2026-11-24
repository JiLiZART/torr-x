## Purpose

One text query language, shared by the tab definitions, the in-tab lens, the filter builder, Spotlight and the
terminal, so that a query typed in any of them means the same thing, fails the same way and offers the same
completions.

## ADDED Requirements

### Requirement: Query grammar
A query SHALL be a sequence of predicates written as `field:value`, combined with whitespace (implicit AND), the
explicit keywords `AND` and `OR`, and at most one level of parentheses. The language SHALL support: `!` before a
value or field to negate it, the comparison operators `>`, `<`, `>=`, `<=` for numeric, size, speed, duration and
date fields, inclusive ranges written `a..b`, double-quoted phrases for exact text, and `*` as a wildcard inside
text values. Field names and bare values SHALL be case-insensitive. An empty query SHALL match every torrent.

#### Scenario: Implicit AND
- **WHEN** the user enters `state:active tag:4k`
- **THEN** only torrents that are active **and** tagged `4k` match

#### Scenario: Explicit OR group
- **WHEN** the user enters `size:>4GB (tracker:a.example OR tracker:b.example)`
- **THEN** torrents larger than 4 GB on either tracker match, and torrents on a third tracker do not

#### Scenario: Negation
- **WHEN** the user enters `state:!paused`
- **THEN** every torrent except paused ones matches

#### Scenario: Quoted phrase
- **WHEN** the user enters `name:"blade runner"`
- **THEN** a torrent named `Blade.Runner.2049` does not match and one named `blade runner 2049` does

### Requirement: Query fields
The language SHALL expose the torrent fields `name`, `state`, `tag`, `category`, `tracker`, `size`, `progress`,
`ratio`, `seeds`, `peers`, `down`, `up`, `eta`, `added`, `done` and `path`, and the section-scoped fields `ext`,
`priority`, `ep`, `season` (files), `country`, `client`, `flags` (peers) and `status` (trackers and web seeds).
`state:` SHALL accept the engine statuses `downloading`, `seeding`, `paused`, `checking`, `queued` and `error`,
plus the derived values `active` (downloading or seeding with a non-zero transfer rate) and `stalled`
(downloading with no connected peers or a zero rate). Size values SHALL accept `KB`, `MB`, `GB`, `TB`; speed
values a `/s` suffix; duration values `s`, `m`, `h`, `d`; date values an ISO date or a relative age such as `7d`.

#### Scenario: Derived state
- **WHEN** a torrent is downloading at 0 B/s with no peers and the user enters `state:stalled`
- **THEN** that torrent matches, and a torrent downloading at 2 MB/s does not

#### Scenario: Size units
- **WHEN** the user enters `size:>4GB`
- **THEN** a 5.2 GB torrent matches and a 700 MB torrent does not

#### Scenario: Relative date
- **WHEN** the user enters `added:>7d`
- **THEN** only torrents added within the last seven days match

### Requirement: Sort is a predicate
Ordering SHALL be expressed inside the query as `sort:<field>[ asc|desc]`, optionally with several
comma-separated keys applied left to right. Numeric, size, speed and date keys SHALL default to descending and
text keys to ascending. Results SHALL be stable, breaking ties by name. The UI SHALL NOT provide any ordering
control that is not expressed as a `sort:` predicate.

#### Scenario: Default direction
- **WHEN** the user enters `sort:ratio`
- **THEN** the highest ratio is listed first

#### Scenario: Multiple keys
- **WHEN** the user enters `sort:state,ratio desc`
- **THEN** torrents are grouped by state and ordered by descending ratio inside each group

### Requirement: Parse errors
An invalid query SHALL produce a structured error carrying a human-readable message, the column and length of the
offending token and, for an unrecognized field, the closest known field name. An unknown field SHALL NOT be
treated as a name search and SHALL NOT silently return an empty result. Every surface that accepts a query SHALL
show the message and mark the offending token.

#### Scenario: Unknown field
- **WHEN** the user enters `statu:active`
- **THEN** the error reads that `statu` is unknown at column 0, marks the five characters, and suggests `state`

#### Scenario: Unterminated quote
- **WHEN** the user enters `name:"blade`
- **THEN** the error points at the opening quote and no filtering is applied

### Requirement: Completion source
The language SHALL provide completions for the caret position: field names when a bare word is being typed,
operators after a field, and values after a field's colon (known states, existing tags, known trackers,
categories and sort keys). Every surface that accepts a query SHALL use this one source, so the same input offers
the same suggestions in the filter bar, the builder, Spotlight and the terminal.

#### Scenario: Value completion
- **WHEN** the caret follows `state:`
- **THEN** the six engine statuses plus `active` and `stalled` are offered

#### Scenario: Tag completion
- **WHEN** the caret follows `tag:` and the library uses the tags `4k`, `shows` and `iso`
- **THEN** those three tags are offered

### Requirement: Canonical text and chips
A parsed query SHALL render back to canonical text and to an ordered list of chips, one per predicate, each
carrying its field, its operator, its value and whether it is a filter or a sort. Re-parsing the canonical text
SHALL produce the same chips. Copying a query SHALL yield the canonical text.

#### Scenario: Round trip
- **WHEN** the user types `TAG:4K   sort:ratio` and copies the query
- **THEN** the clipboard holds `tag:4k sort:ratio desc` and re-parsing it produces the same two chips
