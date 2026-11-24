## ADDED Requirements

### Requirement: Stream endpoint
`GET /torrents/{id}/files/{index}/stream` SHALL serve the file's bytes by relaying the request to the engine's
seekable stream, preserving the client's `Range` header and the upstream status (200/206), `Content-Range`,
`Content-Length` and `Content-Type`. The endpoint SHALL sit behind the same authentication and browser-attack
guards as every other route; the engine's own listener SHALL NOT be exposed to the client. Engines without
streaming SHALL produce `unsupported` (501); an unknown torrent or file index SHALL produce 404.

#### Scenario: Seek while downloading
- **WHEN** a client requests bytes 500000000- of a partially downloaded file whose head and requested range
  are available
- **THEN** the response is 206 with the matching `Content-Range` and those bytes

#### Scenario: Auth applies
- **WHEN** auth is enabled and an unauthenticated request hits the stream endpoint
- **THEN** it is rejected like any other API route

#### Scenario: Unsupported engine
- **WHEN** the active engine is Transmission
- **THEN** the endpoint responds 501 `unsupported`
