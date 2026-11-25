# torrent-query Specification

## Purpose
Defines the query language used to filter and order torrents and their files, including the scopes that decide which fields a query may use.

## Requirements

### Requirement: File-search scope
The query language SHALL provide a file-search scope for searching files across torrents: the file scope's
fields (`name`, `path`, `ext`, `size`, `done`, `priority`, `ep`, `season`) plus `torrent`, a text field on the
owning torrent's name. Bare words SHALL match `name`. Grammar, errors, completion and chips SHALL be the same as
in every other scope.

#### Scenario: Torrent field
- **WHEN** the file-search query is `torrent:expanse ext:mkv`
- **THEN** only `.mkv` files of torrents whose name contains `expanse` match

#### Scenario: Unknown field
- **WHEN** the file-search query is `seeds:>5`
- **THEN** parsing fails with the unknown-field error for `seeds`; torrent fields are not part of the scope

### Requirement: Query grammar
A query SHALL be a sequence of `field:value` predicates combined by whitespace (implicit AND), explicit
`AND`/`OR`, and at most one level of parentheses. It SHALL support `!` negation, `>`, `<`, `>=`, `<=`
comparisons on numeric/size/speed/duration/date fields, inclusive ranges `a..b`, double-quoted phrases, `*`
wildcards in text values, and `sort:<field>[ asc|desc]` with comma-separated multi-keys. Field names and bare
values SHALL be case-insensitive; an empty query SHALL match everything.

#### Scenario: Implicit AND
- **WHEN** the user enters `state:active tag:4k`
- **THEN** only torrents that are active and tagged `4k` match

#### Scenario: OR group and negation
- **WHEN** the user enters `size:>4GB (tracker:a.example OR tracker:b.example) state:!paused`
- **THEN** large torrents on either tracker that are not paused match

#### Scenario: Quoted phrase
- **WHEN** the user enters `name:"blade runner"`
- **THEN** `Blade.Runner.2049` does not match and `blade runner 2049` does

### Requirement: Query fields
The language SHALL expose `name, state, tag, category, tracker, size, progress, ratio, seeds, peers, down,
up, eta, added, done, path`. `state:` SHALL accept `downloading, seeding, paused, checking, queued, error`
plus derived `active` (downloading or seeding with non-zero rate) and `stalled` (downloading with no peers or
zero rate). Sizes accept `KB/MB/GB/TB`, speeds `/s`, durations `s/m/h/d`, dates ISO or relative age (`7d`).

#### Scenario: Derived stalled
- **WHEN** a torrent downloads at 0 B/s with no peers and the query is `state:stalled`
- **THEN** it matches; a torrent at 2 MB/s does not

#### Scenario: Relative date
- **WHEN** the query is `added:>7d`
- **THEN** only torrents added within the last seven days match

### Requirement: Sort is a predicate
Ordering SHALL be expressed only as `sort:` inside the query; numeric/size/speed/date keys default to
descending, text keys to ascending; multi-keys apply left to right; ties break by name. No UI ordering
control may exist that is not a `sort:` predicate.

#### Scenario: Header edits the chip
- **WHEN** the user clicks the SIZE header twice
- **THEN** the chip row shows `sort:size asc` and the list orders by size ascending

### Requirement: Parse errors
A parse failure SHALL produce `{message, column, length, suggestion}` pointing at the failing token, with a
nearest-field suggestion for unknown fields. Every surface SHALL render the same error identically.

#### Scenario: Unknown field
- **WHEN** the user types `statu:active`
- **THEN** the error marks column 0, length 5 and suggests `state`

### Requirement: Completion source
One completion function SHALL serve every surface: field names for a bare word, operators/values after
`field:`, and sort keys after `sort:`.

#### Scenario: Value completion
- **WHEN** the caret follows `state:`
- **THEN** the engine statuses and derived values are offered

### Requirement: Canonical text and chips
`format(ast)` SHALL produce canonical query text and `chips(ast)` ordered key/value/kind tuples for
rendering; round-tripping through parse/format SHALL be stable.

#### Scenario: Round trip
- **WHEN** any valid query is parsed, formatted and re-parsed
- **THEN** the canonical text is unchanged
