## ADDED Requirements

### Requirement: Extended torrent model
In addition to the existing shared fields, each torrent SHALL report `downloaded` and `uploaded` (bytes, session-persistent where the engine allows), `ratio`, `wantedSize` (bytes of wanted files), `tabId` (or null, filled by the server) and `priority`. Details SHALL add `pieceSize`, `pieces`, `availability` (or null), `wasted` (bytes or null), `createdBy`, `comment`, `createdAt`, `trackers[{url, status, lastAnnounce, nextAnnounce, seeds, peers}]`, and per-file `index`, `wanted`, `priority`. Fields an engine cannot know SHALL be null, never invented.

#### Scenario: Unknown field is null
- **WHEN** an engine cannot report `wasted` bytes
- **THEN** the details contain `"wasted": null`

### Requirement: Extended torrent operations
For each of the following that `engine-capabilities` reports as supported for the engine, the engine (natively or via the server) SHALL implement it, and SHALL fail with `unsupported` otherwise: add with options (save path, subfolder, paused, priority, wanted file indices); metadata preview without adding; list peers (address, client, progress, rates, flags, isSeed); piece bitfield; verify (force recheck); relocate with data move; rename; add tracker; set file wanted/priority; set global limits and network/advanced options; and produce the `.torrent` bytes when metadata is known.

#### Scenario: Relocate
- **WHEN** a torrent is relocated to `/data/new` with data move
- **THEN** its files are moved, `savePath` becomes `/data/new`, and it continues without re-downloading completed pieces

#### Scenario: Verify
- **WHEN** verify is requested
- **THEN** the torrent reports status `checking` until the recheck finishes and progress reflects the pieces found

### Requirement: Unsupported error kind
An operation an engine cannot perform SHALL fail with error kind `unsupported` and a message naming the engine and operation.

#### Scenario: Unsupported operation
- **WHEN** super seeding is requested on an engine without it
- **THEN** the operation fails with `unsupported`

### Requirement: Seeding and queue policy
The server SHALL enforce max active downloads / max active torrents (extra torrents `queued`), stop seeding when min ratio or min seeding time is reached if "seed automatically" is off or the limit is set, and move completed downloads to the configured directory — using the engine's native feature when it has one and a server-side policy loop otherwise.

#### Scenario: Ratio reached
- **WHEN** min ratio is 1.0 and a seeding torrent reaches ratio 1.0
- **THEN** within one policy interval (≤ 10 s) it becomes `paused`

#### Scenario: Queue limit
- **WHEN** max active downloads is 2 and a third downloading torrent is added
- **THEN** the third reports `queued` until one of the first two completes or is paused
