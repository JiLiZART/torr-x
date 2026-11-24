## ADDED Requirements

### Requirement: Streaming capability
The capability matrix SHALL include the feature key `streaming`: seekable HTTP playback of a partially
downloaded file. rqbit SHALL report it as supported `via: engine`; Transmission SHALL report it as
unsupported. The UI SHALL render play affordances disabled with the "not supported by <engine>" hint where
unsupported, never hidden.

#### Scenario: rqbit
- **WHEN** the active engine is rqbit
- **THEN** `GET /capabilities` reports `streaming: {supported: true, via: "engine"}`

#### Scenario: Transmission
- **WHEN** the active engine is Transmission
- **THEN** `streaming` is unsupported and the detail page's play button is disabled with "not supported by
  Transmission"
