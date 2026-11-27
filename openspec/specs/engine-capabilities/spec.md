# engine-capabilities Specification

## Purpose
Declares which optional torrent features the active engine (natively or via the server) supports, so the UI can offer real controls and disable the rest honestly.

## Requirements

### Requirement: Capability matrix
`GET /api/v1/capabilities` SHALL return `{engine, features: {<key>: {supported: bool, via: "engine"|"server"|null, note?: string}}}` for keys: `filePriority`, `fileSkip`, `addPreview`, `verify`, `relocate`, `rename`, `addTracker`, `trackerStatus`, `peerList`, `peerClient`, `pieces`, `torrentFile`, `torrentPriority`, `speedLimits`, `maxConnectionsPerTorrent`, `listenPort`, `upnp`, `proxyHttp`, `proxySocks4`, `proxySocks5`, `queue`, `seedLimits`, `moveCompleted`, `diskCache`, `osCache`, `superSeeding`, `dht`, `pex`, `lpd`, `anonymousMode`, `sequentialDownload`, `webSocketTrackers`. Values SHALL be accurate for the engine and version actually connected (Transmission features gated by the daemon's `rpc-version`).

#### Scenario: rqbit file priority
- **WHEN** the engine is rqbit
- **THEN** `fileSkip.supported` is true and `filePriority.supported` is false

#### Scenario: Old Transmission
- **WHEN** the connected Transmission daemon lacks sequential download support
- **THEN** `sequentialDownload.supported` is false

### Requirement: Honest controls
For every control whose feature is unsupported, the UI SHALL render it disabled with the `note` or "not supported by <engine>", SHALL NOT send it, and the server SHALL reject it with `unsupported` if sent anyway (settings values for unsupported keys are persisted but reported as inactive).

#### Scenario: Unsupported setting
- **WHEN** super seeding is unsupported and the settings screen opens
- **THEN** its toggle is disabled with an explanatory hint

### Requirement: Detail capabilities
The capability matrix SHALL include `webSeeds` (reporting web seeds), `addWebSeed`, `reannounce` and
`openFile` (open/reveal a downloaded file on the host), each with `supported` and `via`. The UI SHALL gate
the corresponding controls with the "not supported by <engine>" hint.

#### Scenario: Matrix entries
- **WHEN** the active engine is rqbit
- **THEN** `GET /capabilities` reports the four keys with honest support values

#### Scenario: Gated control
- **WHEN** `reannounce` is unsupported
- **THEN** the failing tracker's re-announce action is disabled with the engine hint

### Requirement: Port test capability
`GET /api/v1/capabilities` SHALL additionally report the feature `portTest` — whether the active engine can
check that its incoming port is reachable from the internet — with `supported` and `via` like every other
feature.

#### Scenario: Engine without a port test
- **WHEN** the active engine has no reachability test
- **THEN** `portTest` is reported as not supported and the settings control for it is disabled with the hint

### Requirement: Engine version and encryption capability
`GET /api/v1/capabilities` SHALL report `version`, the active engine's own version string (the librqbit crate
version, or the Transmission daemon's `version`), or `null` when it is unknown, and SHALL report the feature
`encryption` — whether the engine applies the protocol encryption setting.

#### Scenario: rqbit
- **WHEN** the active engine is rqbit
- **THEN** `version` is the librqbit version and `encryption` is reported as not supported
