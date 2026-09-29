## Purpose

Defines the engine-agnostic torrent model and operations that TorrentX supports, and how the embedded rqbit engine and the Transmission RPC engine each fulfil them.

## ADDED Requirements

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
