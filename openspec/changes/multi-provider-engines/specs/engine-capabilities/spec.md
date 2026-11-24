## MODIFIED Requirements

### Requirement: Capability matrix
`GET /api/v1/capabilities?provider=<id>` SHALL return `{engine, provider, features: {<key>: {supported: bool, via: "engine"|"server"|null, note?: string}}}` for keys: `filePriority`, `fileSkip`, `addPreview`, `verify`, `relocate`, `rename`, `addTracker`, `trackerStatus`, `peerList`, `peerClient`, `pieces`, `torrentFile`, `torrentPriority`, `speedLimits`, `maxConnectionsPerTorrent`, `listenPort`, `upnp`, `proxyHttp`, `proxySocks4`, `proxySocks5`, `queue`, `seedLimits`, `moveCompleted`, `diskCache`, `osCache`, `superSeeding`, `dht`, `pex`, `lpd`, `anonymousMode`, `sequentialDownload`, `webSocketTrackers`, where `engine` is the provider's kind. Without `provider` it SHALL describe the default provider. Every provider in `GET /api/v1/providers` SHALL carry the same matrix. Values SHALL be accurate for the engine and version actually connected (Transmission features gated by the daemon's `rpc-version`, qBittorrent features by its Web API version); an unavailable provider SHALL report every feature unsupported with a note naming the reason.

#### Scenario: rqbit file priority
- **WHEN** the provider is rqbit
- **THEN** `fileSkip.supported` is true and `filePriority.supported` is false

#### Scenario: Old Transmission
- **WHEN** the connected Transmission daemon lacks sequential download support
- **THEN** `sequentialDownload.supported` is false

#### Scenario: Per-provider matrix
- **WHEN** providers `rqbit` and `qb` (qBittorrent) are enabled
- **THEN** `GET /capabilities?provider=qb` reports `filePriority.supported` true and
  `GET /capabilities?provider=rqbit` reports it false

### Requirement: Honest controls
For every control whose feature is unsupported, the UI SHALL render it disabled with the `note` or "not supported by <provider name>", SHALL NOT send it, and the server SHALL reject it with `unsupported` if sent anyway (settings values for unsupported keys are persisted but reported as inactive). Controls acting on a torrent SHALL follow the capabilities of that torrent's provider; global settings controls SHALL be enabled when at least one provider that receives the settings supports them, and their hint SHALL name the receiving providers that do not.

#### Scenario: Unsupported setting
- **WHEN** super seeding is unsupported by every provider that receives the settings and the settings screen opens
- **THEN** its toggle is disabled with an explanatory hint

#### Scenario: Control follows the torrent's provider
- **WHEN** the user opens a torrent of provider `qb` and then one of provider `rqbit`
- **THEN** per-file priority is enabled for the first and disabled with "not supported by rqbit" for the second
