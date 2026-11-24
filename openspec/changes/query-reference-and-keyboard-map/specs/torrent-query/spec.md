## ADDED Requirements

### Requirement: Value groups
A field value MAY be a parenthesised group of alternatives joined by `OR`, written `field:(a OR b)`, meaning
the same as `(field:a OR field:b)`. Value groups SHALL be accepted for any text or enum field and SHALL count
as the one allowed level of grouping. The canonical formatter SHALL emit the grouped form when every arm of an
OR targets the same field.

#### Scenario: Tag alternatives
- **WHEN** the user enters `tag:(4k OR shows)`
- **THEN** torrents tagged `4k` or `shows` match, and the canonical text is unchanged

#### Scenario: Extension alternatives in files
- **WHEN** the user enters `ext:(srt OR sub)` in the Files section
- **THEN** only subtitle files in either extension match

### Requirement: Typed values and ranges
`progress:` SHALL take percent values (`progress:<50`, `progress:100`); `ratio:` SHALL take decimal numbers
and ranges (`ratio:0..0.5`); `size:` SHALL take byte ranges with units (`size:700MB..2GB`); `eta:` SHALL take
durations (`eta:<30m`); `down:`/`up:` SHALL take speeds (`down:>1MB/s`, `up:0`); `added:`/`done:` SHALL take
ISO dates or relative ages (`added:>7d`, `done:<2025-01-01`); `country:` SHALL take ISO-3166 alpha-2 codes.
`tag:` SHALL be an open enum: any value is legal and values seen in the library are offered by completion.

#### Scenario: Decimal range
- **WHEN** the user enters `ratio:0..0.5`
- **THEN** torrents with ratio between 0 and 0.5 inclusive match

#### Scenario: Unknown tag value
- **WHEN** the user enters `tag:neverused`
- **THEN** no torrent matches and no parse error is shown

### Requirement: Field registry metadata
Every field SHALL be registered with a type, the scopes it applies to (list, files, files·media, peers,
trackers, web seeds) and example queries, and this registry SHALL be the single source for the parser,
completion, the unknown-field suggestion and the reference card. The fields SHALL include `name, state, tag,
category, tracker, size, progress, ratio, seeds, peers, down, up, eta, added, done, path` (list), `ext,
priority, ep, season` (files; `ep` and `season` media), `country, client, flags` (peers) and `status`
(trackers and web seeds).

#### Scenario: Unknown field is loud
- **WHEN** the user enters a field that is not registered
- **THEN** an inline error with a suggestion is shown; the query is never silently treated as matching nothing

#### Scenario: Lens does not rewrite the tab
- **WHEN** a lens is applied on top of a tab query
- **THEN** the result is the AND of both and the tab's stored query text is unchanged

### Requirement: Canonical copy
Copying a chip row SHALL place the canonical query text on the clipboard, and pasting that text into any
query surface (filter bar, builder, palette, terminal, section filter bars, tab editor) SHALL reproduce the
same chips.

#### Scenario: Cross-surface paste
- **WHEN** the user copies the lens from the filter bar and pastes it into the terminal prompt after `ls`
- **THEN** the same predicates are parsed and the same result set is printed
