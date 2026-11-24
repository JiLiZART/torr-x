## Purpose

Declares which optional torrent features the active engine (natively or via the server) supports, so the UI can offer real controls and disable the rest honestly.

## ADDED Requirements

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
