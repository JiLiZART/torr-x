## MODIFIED Requirements

### Requirement: Engine-agnostic torrent model
Every engine SHALL report torrents using one shared model: `id` (`<providerId>:<infoHash>`, see
`torrent-providers`), `provider` (provider id), `infoHash` (lowercase hex info-hash), `name`, `size` (bytes),
`progress` (0.0–1.0), `downloadRate` and `uploadRate` (bytes/s), `peers`, `seeds`, `status` (one of
`downloading`, `seeding`, `paused`, `checking`, `queued`, `error`), `error` (message or null), `etaSecs` (null
when unknown or complete), `addedAt` (unix seconds), and `savePath`.

#### Scenario: Same torrent, same id across engines
- **WHEN** the same magnet link is added to an rqbit provider, a Transmission provider and a qBittorrent provider
- **THEN** all three report the identical `infoHash` equal to the torrent's info-hash, and ids that differ only
  in the provider prefix

### Requirement: Seeding and queue policy
The server SHALL enforce max active downloads / max active torrents (extra torrents `queued`), stop seeding when
min ratio or min seeding time is reached if "seed automatically" is off or the limit is set, and move completed
downloads to the configured directory — using the engine's native feature when it has one and a server-side
policy loop otherwise. Queue limits SHALL count torrents per provider; seeding limits and move-completed SHALL
apply to the torrents of every enabled provider, each decided with that provider's capabilities. An unavailable
provider SHALL be skipped without affecting the others.

#### Scenario: Ratio reached
- **WHEN** min ratio is 1.0 and a seeding torrent reaches ratio 1.0
- **THEN** within one policy interval (≤ 10 s) it becomes `paused`

#### Scenario: Queue limit
- **WHEN** max active downloads is 2 and a third downloading torrent is added
- **THEN** the third reports `queued` until one of the first two completes or is paused

#### Scenario: Queue limits per provider
- **WHEN** max active downloads is 2 and providers `rqbit` and `nas` each have two downloading torrents
- **THEN** all four keep downloading

## ADDED Requirements

### Requirement: qBittorrent engine
The qBittorrent engine SHALL control a qBittorrent instance (4.1 or later, including 5.x) through its Web API
v2 using the configured host, port, path prefix, https flag and optional username/password, renewing the login
session transparently when it expires. It SHALL use the daemon's start/stop or resume/pause operations as the
daemon's API version requires. qBittorrent states SHALL map to the shared model: downloading, forced, metadata
and stalled downloads → `downloading`; uploading, forced and stalled uploads → `seeding`; paused and stopped →
`paused`; queued → `queued`; checking, resume-data checks and moving → `checking`; error and missing files →
`error`. It SHALL support the torrent operations and extended operations of this spec, failing with
`unsupported` for any the connected version lacks (`.torrent` export needs Web API 2.8.14+). Add preview SHALL
be `unsupported`.

#### Scenario: Login renewal
- **WHEN** the session cookie has expired and the next call is answered 403
- **THEN** the engine logs in again once and the call succeeds

#### Scenario: Wrong credentials
- **WHEN** login is refused
- **THEN** operations fail with `engine_unavailable` and a message stating authentication failed

#### Scenario: qBittorrent 5 pause
- **WHEN** a torrent on a qBittorrent 5.x provider is paused
- **THEN** the daemon's stop operation is used and the torrent reports `paused`

#### Scenario: Status mapping
- **WHEN** qBittorrent reports a torrent as `stalledUP`
- **THEN** it is listed with status `seeding`
