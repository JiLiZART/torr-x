## MODIFIED Requirements

### Requirement: Torrent endpoints
The server SHALL provide:
- `GET /api/v1/torrents` → array of torrents in the shared model, each carrying `tags: string[]` (replacing
  `tabId`)
- `GET /api/v1/torrents/{id}` → one torrent plus `files`
- `POST /api/v1/torrents` with JSON `{"uri": "<magnet or http(s) url>"}` or `multipart/form-data` with a `file` field containing a `.torrent` → `201 {"id": "<id>"}`
- `POST /api/v1/torrents/{id}/pause` and `/resume` → 204
- `DELETE /api/v1/torrents/{id}?deleteData=true|false` → 204 (default `false`)
- `PUT /api/v1/torrents/{id}/tags` with a JSON array → 204; the former `PUT /torrents/{id}/tab` SHALL respond
  410 with a pointer to the tags route

#### Scenario: Add by magnet
- **WHEN** a client posts `{"uri": "magnet:?xt=urn:btih:..."}` to `/api/v1/torrents`
- **THEN** the response is 201 with the torrent id and a subsequent list contains it

#### Scenario: Upload torrent file
- **WHEN** a client posts a multipart form with a valid `.torrent` in field `file`
- **THEN** the response is 201 with the torrent id

#### Scenario: Tags replace membership
- **WHEN** a client sets tags on a torrent and lists torrents
- **THEN** the torrent carries exactly those tags and no `tabId` field exists

## ADDED Requirements

### Requirement: Tab endpoints carry queries
`GET/POST /api/v1/tabs` and `PATCH/DELETE /api/v1/tabs/{id}` SHALL read and write tabs as
`{id, name, query, order, pinned, group}` with a stored grammar version. Query text SHALL round-trip
verbatim, including queries the server cannot parse. State SHALL migrate from membership tabs on load.

#### Scenario: Verbatim round trip
- **WHEN** a tab is created with query `statu:active` (unparseable)
- **THEN** `GET /tabs` returns the same text unchanged with the grammar version

#### Scenario: Migration on load
- **WHEN** a v2 `state.json` with assignments is loaded
- **THEN** the server writes v3 state with tags and `tag:<slug>` tab queries and serves it
