## ADDED Requirements

### Requirement: Stream links
`POST /torrents/{id}/files/{index}/stream` SHALL return `{path}` = `/api/v1/stream/<token>/<name>`, behind the
same authentication and guards as every other route. Issuing a link SHALL resume a paused torrent and mark
the file wanted. The token SHALL be kept in memory, valid for 6 hours since its last use, and cleared
together with sessions. `GET /api/v1/stream/{token}/{name}` SHALL need no login (the token is the credential)
but SHALL still pass the Host guard. It SHALL serve the file's bytes with HTTP ranges: 206 with
`Content-Range` for a satisfiable range, 416 otherwise, 200 without a range. An unknown or expired token SHALL
produce 404. Engines without streaming SHALL produce `unsupported` (501) when a link is requested; an
unknown torrent or file index SHALL produce 404.

#### Scenario: Seek while downloading
- **WHEN** a player requests bytes 500000000- of a partially downloaded file through a live link
- **THEN** the response is 206 with the matching `Content-Range`, sent as the pieces arrive

#### Scenario: Auth applies to issuing
- **WHEN** auth is enabled and an unauthenticated request asks for a stream link
- **THEN** it is rejected like any other API route

#### Scenario: Unsupported engine
- **WHEN** the active engine is Transmission
- **THEN** requesting a stream link responds 501 `unsupported`

### Requirement: Play on the machine itself
`POST /torrents/{id}/files/{index}/play` SHALL be accepted only from loopback. For a finished file it SHALL open
the file from disk in `preferences.player`, else the system default; for an unfinished file it SHALL open a
stream link in `preferences.player`, else the first of IINA, VLC or mpv found, and return `{streaming: true}`.

#### Scenario: Remote request
- **WHEN** a non-loopback client calls the play endpoint
- **THEN** it is refused like the other open/reveal endpoints
