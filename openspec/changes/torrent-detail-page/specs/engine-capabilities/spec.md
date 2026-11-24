## ADDED Requirements

### Requirement: Detail capabilities
`GET /api/v1/capabilities` SHALL additionally report the features `webSeeds` (the engine reports a torrent's web
seeds), `addWebSeed`, `reannounce` and `openFile` (opening a downloaded file on the server's machine, provided by
the server), each with `supported` and `via` like every other feature.

#### Scenario: Open file is a server feature
- **WHEN** a client requests capabilities under any engine
- **THEN** `openFile` is reported as supported with `via: "server"`

#### Scenario: Web seeds unsupported
- **WHEN** the active engine does not report web seeds
- **THEN** `webSeeds` and `addWebSeed` are reported as not supported
