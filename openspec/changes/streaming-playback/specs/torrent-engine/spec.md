## ADDED Requirements

### Requirement: Seekable file stream
Engines SHALL expose a seekable byte stream for an individual file where they support one: the rqbit engine
SHALL return the file's length and librqbit's `FileStream`, which reads the pieces it needs first; the
Transmission engine SHALL return the `unsupported` error kind. No engine SHALL be asked to reorder pieces to
simulate streaming.

#### Scenario: rqbit stream
- **WHEN** the server requests the stream for file 0 of a downloading torrent on rqbit
- **THEN** the engine returns a reader that seeks to any offset and waits for the pieces there

#### Scenario: Transmission
- **WHEN** the server requests a file stream on Transmission
- **THEN** the engine returns `unsupported`
