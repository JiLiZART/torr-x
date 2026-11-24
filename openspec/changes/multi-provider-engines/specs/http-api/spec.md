## MODIFIED Requirements

### Requirement: Health endpoint
`GET /api/v1/health` SHALL always be reachable without authentication and return `{"app": "torrentx", "version": "<semver>", "engine": "rqbit" | "transmission" | "qbittorrent", "authRequired": <bool>}`, where `engine` is the kind of the default provider. It SHALL NOT reveal provider ids, names or connection details.

#### Scenario: Identify a TorrentX server
- **WHEN** a client calls `GET /api/v1/health` on a running server with auth enabled
- **THEN** it receives 200 with `app` = `torrentx` and `authRequired` = true

#### Scenario: Engine is the default provider's kind
- **WHEN** the default provider is a qBittorrent provider
- **THEN** `engine` = `qbittorrent` and no host or provider name appears in the body

### Requirement: Torrent endpoints
The server SHALL provide:
- `GET /api/v1/torrents` → array of torrents of every reachable provider in the shared model, each carrying
  `provider`, `infoHash` and `tags: string[]` (replacing `tabId`)
- `GET /api/v1/torrents/{id}` → one torrent plus `files`
- `POST /api/v1/torrents` with JSON `{"uri": "<magnet or http(s) url>", "provider"?: "<id>"}` or `multipart/form-data` with a `file` field containing a `.torrent` and an optional `provider` field → `201 {"id": "<providerId>:<infoHash>"}`
- `POST /api/v1/torrents/{id}/pause` and `/resume` → 204
- `DELETE /api/v1/torrents/{id}?deleteData=true|false` → 204 (default `false`)
- `PUT /api/v1/torrents/{id}/tags` with a JSON array → 204; the former `PUT /torrents/{id}/tab` SHALL respond
  410 with a pointer to the tags route
`{id}` SHALL accept a scoped id or a bare info-hash as specified in `torrent-providers`.

#### Scenario: Add by magnet
- **WHEN** a client posts `{"uri": "magnet:?xt=urn:btih:..."}` to `/api/v1/torrents`
- **THEN** the response is 201 with the torrent id scoped to the default provider and a subsequent list contains it

#### Scenario: Upload torrent file
- **WHEN** a client posts a multipart form with a valid `.torrent` in field `file`
- **THEN** the response is 201 with the torrent id

#### Scenario: Add to a named provider
- **WHEN** a client posts `{"uri": "magnet:?xt=urn:btih:ab12...", "provider": "nas"}`
- **THEN** the response is 201 with id `nas:ab12...`

#### Scenario: Tags replace membership
- **WHEN** a client sets tags on a torrent and lists torrents
- **THEN** the torrent carries exactly those tags and no `tabId` field exists

### Requirement: Settings endpoints
`GET /api/v1/settings` SHALL return the current settings grouped as `server` (bind, port, allowedHosts), `auth` (enabled, username), `providers` (ordered array of `{id, name, kind, enabled, manageSettings}` plus, for rqbit, `downloadDir`, and for transmission and qbittorrent, `host`, `port`, `path`, `https`, `username`, `hasPassword`), `defaultProvider` (provider id), `network` (maxConnectionsPerTorrent, maxUploadKBps, maxDownloadKBps, listenPort, upnp, proxy {type, host, port, authRequired, username, hasPassword}), `downloads` (defaultSavePath, createSubfolder, moveCompletedEnabled, moveCompletedPath, maxActiveDownloads, maxActiveTorrents, startAutomatically, defaultPriority, seedAutomatically, minRatio, minSeedingMinutes), `advanced` (diskCacheMB, osCache, superSeeding, dht, pex, lpd, anonymousMode, sequentialDownload, webSocketTrackers) and `preferences` (see `app-preferences`). It SHALL NOT return any password or password hash. `PUT /api/v1/settings` SHALL validate, persist to the config file, and apply the new settings. Provider changes SHALL take effect immediately for the affected providers only; network, downloads and advanced values SHALL be pushed to the providers that receive settings (see `torrent-providers`) without restarting the server, restarting only an engine that requires it. A provider password omitted from the request SHALL be kept. Bind address or port changes SHALL be persisted and the response SHALL include `"restartRequired": true`. Config files written by earlier versions (Transmission `url`, single `engine` section) SHALL be migrated on load.

#### Scenario: Switch engine live
- **WHEN** a client PUTs settings making a Transmission provider the default and disabling `rqbit`
- **THEN** the response is 200, and the next `GET /api/v1/health` reports `engine` = `transmission`

#### Scenario: Add a provider through settings
- **WHEN** a client PUTs settings with an extra provider `{id: "nas", kind: "transmission", host: "nas"}`
- **THEN** the response is 200 and the next `GET /api/v1/providers` lists `nas` with its status

#### Scenario: Change port
- **WHEN** a client PUTs settings changing the port
- **THEN** the response contains `restartRequired: true`, the config file holds the new port, and the server keeps serving on the old port until restarted

#### Scenario: Invalid settings rejected
- **WHEN** a client PUTs a `transmission` provider with an empty host, or a port outside 1–65535
- **THEN** the response is 400 `invalid_input` and nothing is persisted

#### Scenario: Password never leaks
- **WHEN** auth is enabled and a client GETs settings
- **THEN** the body contains the username but no password or hash field, and providers carry only `hasPassword`

#### Scenario: Legacy config migrated
- **WHEN** the server starts with a config containing `engine.kind = "transmission"` and `transmission.url = "http://nas:9091/transmission/rpc"`
- **THEN** GET settings returns a provider `transmission` with host `nas`, port 9091, path `/transmission/rpc`, https false, as `defaultProvider`

### Requirement: Extended torrent endpoints
In addition to the existing torrent endpoints, the server SHALL provide:
- `GET /api/v1/torrents/{id}` returning the extended details model (`torrent-engine`), plus `GET /api/v1/torrents/{id}/peers` (with `country` ISO code or null) and `GET /api/v1/torrents/{id}/pieces` (`{"count": n, "bitfield": "<base64>"}`)
- `POST /api/v1/torrents/preview` (same body forms as add, including optional `provider`) → metadata preview `{id, name, size, pieceSize, pieces, createdAt, createdBy, comment, trackers, files[{index, path, size}]}` without adding the torrent
- `POST /api/v1/torrents` accepting optional `savePath`, `createSubfolder`, `paused`, `priority`, `wantedFiles` (indices) alongside `uri`/`file`
- `POST /api/v1/torrents/{id}/verify`, `/relocate` `{"path", "moveData": true}`, `/rename` `{"name"}`, `/trackers` `{"url"}` → 204
- `PUT /api/v1/torrents/{id}/files` `{"indices": [..], "wanted"?: bool, "priority"?: "low"|"normal"|"high"}` → 204
- `GET /api/v1/torrents/{id}/magnet` → `{"uri"}`; `GET /api/v1/torrents/{id}/torrent-file` → `application/x-bittorrent` attachment
- `POST /api/v1/torrents/{id}/reveal` → opens the torrent's location in the file manager of the machine running the server; allowed only for requests from a loopback peer and only for torrents of the built-in provider, otherwise 403 `forbidden`
- `POST /api/v1/providers/test` with a provider's kind and connection fields → 204 or the engine error, without persisting; the former `POST /api/v1/transmission/test` SHALL respond 410 with a pointer to it
All mutations SHALL be subject to the existing auth, Host and Origin guards. An operation the torrent's provider cannot perform SHALL fail with 501 `unsupported`.

#### Scenario: Preview does not add
- **WHEN** a client posts a magnet to `/torrents/preview`
- **THEN** the response lists the files and a following `GET /torrents` does not contain that torrent

#### Scenario: Reveal from remote browser
- **WHEN** a request from a non-loopback address posts `/torrents/{id}/reveal`
- **THEN** the response is 403 `forbidden` and nothing is opened

#### Scenario: Reveal a remote provider's torrent
- **WHEN** a loopback request posts `/torrents/nas:ab12.../reveal`
- **THEN** the response is 403 `forbidden`, because the data lives on the daemon's machine

#### Scenario: Unsupported per-file priority
- **WHEN** the torrent's provider cannot set file priority and a client PUTs `priority: "high"`
- **THEN** the response is 501 with error kind `unsupported`

#### Scenario: Test a qBittorrent connection
- **WHEN** a client posts `{kind: "qbittorrent", host: "seedbox", port: 8080, username: "u", password: "wrong"}` to `/providers/test`
- **THEN** the response is 503 `engine_unavailable` stating authentication failed, and nothing is persisted

### Requirement: Stats and capabilities endpoints
The server SHALL provide `GET /api/v1/stats` (see `system-stats`) with session totals summed over reachable providers, and `GET /api/v1/capabilities` (see `engine-capabilities`); `GET /api/v1/health` SHALL additionally report the server version used by the update check.

#### Scenario: Capabilities follow engine
- **WHEN** a Transmission provider becomes the default provider
- **THEN** the next `GET /api/v1/capabilities` without `provider` reflects Transmission's feature set

## ADDED Requirements

### Requirement: Provider endpoints
The server SHALL provide `GET /api/v1/providers` → `[{id, name, kind, enabled, default, manageSettings, status: "running"|"unavailable"|"disabled", error, version, capabilities, torrentCount}]` (no passwords), `POST /api/v1/providers` with a provider definition → 201 provider, `PATCH /api/v1/providers/{id}` with any subset of `name`, `enabled`, `default`, `manageSettings` and connection fields → 200 provider, and `DELETE /api/v1/providers/{id}` → 204, enforcing the rules of `torrent-providers`. These endpoints SHALL persist to the config file like `PUT /settings` and SHALL be subject to the existing auth, Host and Origin guards.

#### Scenario: Status of a down provider
- **WHEN** provider `nas` cannot be reached
- **THEN** `GET /providers` lists it with `status: "unavailable"`, its error message, and `torrentCount: null`

#### Scenario: Make default
- **WHEN** a client PATCHes `{"default": true}` on provider `nas`
- **THEN** `nas` is the only provider with `default: true` and `GET /settings` reports `defaultProvider: "nas"`
