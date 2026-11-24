## MODIFIED Requirements

### Requirement: Torrent endpoints
The server SHALL provide:
- `GET /api/v1/torrents` → array of torrents in the shared model
- `GET /api/v1/torrents/{id}` → one torrent plus `files`
- `POST /api/v1/torrents` with JSON `{"uri": "<magnet or http(s) url>"}` or `multipart/form-data` with a `file` field containing a `.torrent` → `201 {"id": "<id>"}`
- `POST /api/v1/torrents/{id}/pause` and `/resume` → 204
- `DELETE /api/v1/torrents/{id}?deleteData=true|false` → 204 (default `false`)
- `PUT /api/v1/torrents/{id}/tags` with a JSON array of strings → 204, replacing the torrent's whole tag set

Every torrent object SHALL carry `tags` (an array of strings, possibly empty) instead of `tabId`.
`PUT /api/v1/torrents/{id}/tab` SHALL respond 410 with an error body naming `PUT /api/v1/torrents/{id}/tags`.
Responses SHALL keep using lowercase hex info-hashes as ids and SHALL NOT invent values for data an engine does
not report.

#### Scenario: Add by magnet
- **WHEN** a client posts `{"uri": "magnet:?xt=urn:btih:..."}` to `/api/v1/torrents`
- **THEN** the response is 201 with the torrent id and a subsequent list contains it

#### Scenario: Upload torrent file
- **WHEN** a client posts a multipart form with a valid `.torrent` in field `file`
- **THEN** the response is 201 with the torrent id

#### Scenario: Tags replace tab assignment
- **WHEN** a client sends `PUT /api/v1/torrents/{id}/tags` with `["4k","movies"]`
- **THEN** the response is 204 and the torrent is subsequently listed with exactly those two tags

#### Scenario: Old assignment route is gone
- **WHEN** a client calls `PUT /api/v1/torrents/{id}/tab`
- **THEN** the response is 410 and its message names `PUT /api/v1/torrents/{id}/tags`

#### Scenario: Untagged torrent
- **WHEN** a torrent has never been tagged
- **THEN** it is listed with `"tags": []`, not `null`

## ADDED Requirements

### Requirement: Tab endpoints carry queries
`GET /api/v1/tabs` SHALL return each tab as `{id, name, query, order, pinned, group}`. `POST /api/v1/tabs` SHALL
accept the same fields (query, pinned and group optional, defaulting to empty, false and null) and
`PATCH /api/v1/tabs/{id}` SHALL accept any subset of them. The server SHALL NOT reject a syntactically invalid
query, and SHALL return queries exactly as stored.

#### Scenario: Create a smart tab
- **WHEN** a client posts `{"name":"4K","query":"state:active tag:4k sort:ratio desc","pinned":true}`
- **THEN** the response carries the new id and `GET /api/v1/tabs` returns that query verbatim

#### Scenario: Patch only the query
- **WHEN** a client patches `{"query":"tag:iso"}` on an existing tab
- **THEN** the tab's name, order, pinned flag and group are unchanged
