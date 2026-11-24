## ADDED Requirements

### Requirement: Detail action endpoints
The server SHALL provide, under `/api/v1`:
- `POST /torrents/{id}/files/{index}/open` → 204; opens that file with the default application of the machine
  running the server. It SHALL be refused with 403 `forbidden` for requests from a non-loopback peer, and with
  409 `conflict` when the file is not completely downloaded.
- `POST /torrents/{id}/reveal` SHALL accept an optional body `{"fileIndex": n}` and then select that file in the
  file manager; without a body it behaves as before.
- `POST /torrents/{id}/reannounce` → 204; asks the engine to announce to the torrent's trackers now.
- `POST /torrents/{id}/web-seeds` `{"url"}` → 204; adds a web seed.
An unknown file index SHALL respond 404 `not_found`. An operation the active engine cannot perform SHALL fail
with 501 `unsupported`. All of these SHALL be subject to the existing auth, Host and Origin guards.

#### Scenario: Open a finished file
- **WHEN** a loopback client posts `/torrents/{id}/files/0/open` for a complete file
- **THEN** the response is 204 and the file is opened on the server's machine

#### Scenario: Open from a remote browser
- **WHEN** a non-loopback client posts `/torrents/{id}/files/0/open`
- **THEN** the response is 403 `forbidden` and nothing is opened

#### Scenario: Open an incomplete file
- **WHEN** the file's progress is below 1
- **THEN** the response is 409 `conflict`

#### Scenario: Re-announce unsupported
- **WHEN** the active engine cannot re-announce and a client posts `/torrents/{id}/reannounce`
- **THEN** the response is 501 with error kind `unsupported`

### Requirement: Detail model fields
`GET /api/v1/torrents/{id}` SHALL return each tracker with, in addition to the existing fields, `tier` (number or
null), `kind` (`tracker`, `dht`, `pex` or `lsd`), `leechers` (number or null), `downloaded` (number or null) and
`error` (string or null), with `status` being one of `working`, `updating`, `not working`, `disabled` or null;
and SHALL return `webSeeds`, either null when the engine does not report web seeds or an array of `{url, status,
downloadRate, downloaded, error}`. `GET /api/v1/torrents/{id}/peers` SHALL return each peer with `encryption`
(string or null). Fields the engine does not report SHALL be null.

#### Scenario: Tracker failure reason
- **WHEN** a tracker refused the last announce
- **THEN** its entry has `status: "not working"` and the tracker's message in `error`

#### Scenario: No web seed support
- **WHEN** the active engine does not report web seeds
- **THEN** `webSeeds` is `null`, not an empty array

#### Scenario: Unknown tier
- **WHEN** the engine does not expose tracker tiers
- **THEN** every tracker has `tier: null`
