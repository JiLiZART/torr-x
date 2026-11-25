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
