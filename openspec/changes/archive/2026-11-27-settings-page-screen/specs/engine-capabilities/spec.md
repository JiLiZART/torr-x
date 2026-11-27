## ADDED Requirements

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
