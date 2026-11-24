## ADDED Requirements

### Requirement: Files across torrents endpoint
The server SHALL provide `GET /api/v1/files` → a flat array of `{torrentId, torrentName, index, path, size,
progress, wanted, priority}` covering every file of every torrent whose metadata is known, in list order and,
within a torrent, in the torrent's file order. `torrentName` SHALL reflect rename overrides. Torrents without
metadata yet (magnets still resolving) SHALL contribute no entries. The server SHALL NOT filter, sort or
paginate by query. The endpoint SHALL be subject to the existing auth, Host and Origin guards and SHALL fail
with `engine_unavailable` like the torrent list. A Transmission engine SHALL serve it with one RPC call
regardless of the number of torrents.

#### Scenario: All files in one request
- **WHEN** two torrents with 3 and 5 files are present and a client calls `GET /api/v1/files`
- **THEN** the response has 8 entries, each naming its torrent id and name

#### Scenario: Unresolved magnet
- **WHEN** a magnet torrent has no metadata yet
- **THEN** it contributes no entries and the call still succeeds

#### Scenario: Renamed torrent
- **WHEN** a torrent has a display-name override
- **THEN** its entries carry the overridden name as `torrentName`
