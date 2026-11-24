## ADDED Requirements

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
