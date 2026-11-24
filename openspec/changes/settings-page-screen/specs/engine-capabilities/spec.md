## ADDED Requirements

### Requirement: Port test capability
`GET /api/v1/capabilities` SHALL additionally report the feature `portTest` — whether the active engine can
check that its incoming port is reachable from the internet — with `supported` and `via` like every other
feature.

#### Scenario: Engine without a port test
- **WHEN** the active engine has no reachability test
- **THEN** `portTest` is reported as not supported and the settings control for it is disabled with the hint
