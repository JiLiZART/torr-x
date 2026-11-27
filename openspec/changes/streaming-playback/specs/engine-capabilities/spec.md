## ADDED Requirements

### Requirement: Stream capability
The capability matrix SHALL include the feature key `stream`: seekable HTTP playback of a file while it
downloads. rqbit SHALL report it as supported `via: engine`; Transmission SHALL report it as unsupported. The
UI SHALL render play affordances for unfinished files disabled with the "not supported by <engine>" hint
where it is unsupported, never hidden.

#### Scenario: rqbit
- **WHEN** the active engine is rqbit
- **THEN** `GET /capabilities` reports `stream: {supported: true, via: "engine"}`

#### Scenario: Transmission
- **WHEN** the active engine is Transmission and a video file is unfinished
- **THEN** its Play button is disabled with "not supported by Transmission"
