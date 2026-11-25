# torrent-engine Specification

## Purpose
Defines the engine-agnostic torrent model and operations that TorrentX supports, and how the embedded rqbit engine and the Transmission RPC engine each fulfil them.

## Requirements

### Requirement: Engine-agnostic torrent model
Every engine SHALL report torrents using one shared model: `id` (lowercase hex info-hash), `name`, `size` (bytes), `progress` (0.0–1.0), `downloadRate` and `uploadRate` (bytes/s), `peers`, `seeds`, `status` (one of `downloading`, `seeding`, `paused`, `checking`, `queued`, `error`), `error` (message or null), `etaSecs` (null when unknown or complete), `addedAt` (unix seconds), and `savePath`.

#### Scenario: Same torrent, same id across engines
- **WHEN** the same magnet link is added under the rqbit engine and, separately, under the Transmission engine
- **THEN** both engines report the torrent with the identical `id` equal to its info-hash

### Requirement: Torrent operations
Every engine SHALL support: list all torrents; get one torrent's details including its file list (path, size, progress per file); add a torrent from a magnet URI, an http(s) URL to a `.torrent` file, or raw `.torrent` file bytes; pause; resume; and remove with or without deleting downloaded data.

#### Scenario: Add magnet
- **WHEN** a valid magnet URI is added
- **THEN** the engine returns the torrent's `id` and the torrent appears in the list

#### Scenario: Add torrent file bytes
- **WHEN** valid `.torrent` file bytes are added
- **THEN** the engine returns the torrent's `id` and the torrent appears in the list with its name

#### Scenario: Pause and resume
- **WHEN** a downloading torrent is paused
- **THEN** its status becomes `paused` and rates drop to 0; **AND WHEN** it is resumed, its status leaves `paused`

#### Scenario: Remove keeping data
- **WHEN** a torrent is removed with delete-data false
- **THEN** it disappears from the list and its downloaded files remain on disk

#### Scenario: Remove deleting data
- **WHEN** a torrent is removed with delete-data true
- **THEN** it disappears from the list and its downloaded files are deleted

### Requirement: Engine error reporting
Engine operations SHALL fail with a distinguishable error kind: `not_found` (unknown torrent id), `invalid_input` (unparseable magnet/URL/torrent file), `duplicate` (torrent already present), or `engine_unavailable` (engine not reachable or not started), plus a human-readable message.

#### Scenario: Unknown id
- **WHEN** pause is requested for an id not present in the engine
- **THEN** the operation fails with `not_found`

#### Scenario: Garbage input
- **WHEN** add is called with the string `not-a-magnet`
- **THEN** the operation fails with `invalid_input`

### Requirement: Embedded rqbit engine
The rqbit engine SHALL download and seed torrents in-process without any external daemon, save data to the configured download directory, and persist its torrent list so torrents (and their paused/running state) are restored after a server restart.

#### Scenario: Survives restart
- **WHEN** the server is restarted while the rqbit engine has two torrents, one paused
- **THEN** after restart both torrents are listed and the paused one is still `paused`

### Requirement: Transmission engine
The Transmission engine SHALL control an external Transmission daemon via its RPC endpoint using the configured URL and optional RPC username/password, transparently handling Transmission's session-id handshake (HTTP 409 renewal). Transmission's native statuses SHALL map to the shared model: stopped→`paused`, check-wait/check→`checking`, download-wait/seed-wait→`queued`, download→`downloading`, seed→`seeding`, any torrent with a non-zero error→`error`.

#### Scenario: Session id renewal
- **WHEN** the daemon responds 409 with a new `X-Transmission-Session-Id`
- **THEN** the engine retries once with the new session id and the operation succeeds

#### Scenario: Daemon unreachable
- **WHEN** the configured Transmission URL does not accept connections
- **THEN** operations fail with `engine_unavailable` and the server keeps running

#### Scenario: Wrong RPC credentials
- **WHEN** the daemon responds 401
- **THEN** operations fail with `engine_unavailable` and a message stating authentication failed

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

### Requirement: Extended tracker, peer and web-seed detail
Both engines SHALL fill the extended detail model where they can: tracker tier, kind (including DHT/PeX
pseudo-rows), leechers, downloaded bytes, failure text and announce schedule; peer flags and encryption;
web-seed URL, BEP kind, status, speed, downloaded and error. Anything an engine cannot report SHALL be
`null`. Neither engine SHALL synthesize values to fill the model.

#### Scenario: Transmission tracker stats
- **WHEN** Transmission reports trackerStats
- **THEN** tier, seeder/leecher counts, last/next announce and failure text map into the shared model

#### Scenario: rqbit gaps
- **WHEN** rqbit does not expose per-tracker downloaded bytes
- **THEN** that field is `null` on every tracker
