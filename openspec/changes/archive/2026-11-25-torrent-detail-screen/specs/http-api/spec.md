## ADDED Requirements

### Requirement: Detail action endpoints
The server SHALL provide `POST /torrents/{id}/reannounce`, `POST /torrents/{id}/web-seeds` (JSON `{url}`),
`POST /torrents/{id}/files/{index}/open` and `POST /torrents/{id}/files/{index}/reveal`. Unsupported
operations SHALL return 501 `unsupported`; unknown torrent or file index SHALL return 404. All routes SHALL
sit behind the same auth and browser-attack guards as other mutations.

#### Scenario: Re-announce
- **WHEN** a client posts reannounce for a torrent on an engine that supports it
- **THEN** the response is 204 and the tracker's last-announce resets

#### Scenario: Unsupported
- **WHEN** a client adds a web seed on an engine without the feature
- **THEN** the response is 501 `unsupported`

#### Scenario: Bad file index
- **WHEN** a client opens file index 99 of an 18-file torrent
- **THEN** the response is 404

### Requirement: Detail model fields
`GET /torrents/{id}` SHALL return trackers with `tier`, `kind` (`tracker | dht | pex`), `leechers`,
`downloaded`, `error`, `lastAnnounce`, `nextAnnounce`; peers with `flags` and `encryption`; and a `webSeeds`
array with `url`, `kind` (`bep19 | bep17`), `status`, `speed`, `downloaded`, `error`. Fields an engine does
not report SHALL be `null`, never invented. The drift fixture and TS types SHALL be updated together with
the Rust model.

#### Scenario: Honest nulls
- **WHEN** the engine reports no per-tracker downloaded bytes
- **THEN** the field is `null` and the UI renders `—`

#### Scenario: Pseudo-rows
- **WHEN** the engine exposes DHT and PeX
- **THEN** they appear as trackers with `kind: "dht"` / `"pex"` and null tier
