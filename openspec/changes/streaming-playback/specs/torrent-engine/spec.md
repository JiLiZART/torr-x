## ADDED Requirements

### Requirement: Seekable file stream
Engines SHALL expose a seekable byte stream for an individual file where they support one: the rqbit engine
SHALL provide its per-file HTTP stream URL (sequential download makes the file head available first); the
Transmission engine SHALL return the `unsupported` error kind. No engine SHALL be asked to reorder pieces to
simulate streaming.

#### Scenario: rqbit stream
- **WHEN** the server requests the stream for file 0 of a downloading torrent on rqbit
- **THEN** the engine provides a URL serving that file's bytes with Range support

#### Scenario: Transmission
- **WHEN** the server requests a file stream on Transmission
- **THEN** the engine returns `unsupported`
