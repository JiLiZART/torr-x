## ADDED Requirements

### Requirement: Provenance field
The query language SHALL expose the field `by:` matching `Torrent.addedBy` as case-insensitive text with `*`
wildcards; `by:unknown` SHALL match torrents whose provenance is null. `by:!you` SHALL match every torrent
not added through the UI.

#### Scenario: Overnight batch
- **WHEN** the user enters `by:!you added:<24h`
- **THEN** only torrents added by automation within the last day match

#### Scenario: Unknown provenance
- **WHEN** the user enters `by:unknown`
- **THEN** only torrents with null `addedBy` match
