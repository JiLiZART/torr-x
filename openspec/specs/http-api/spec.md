# http-api Specification

## Purpose
Defines the versioned JSON HTTP API through which the web UI, desktop app, and scripts control the server's active torrent engine and its settings, including optional auth and localhost request protections.

## Requirements

### Requirement: Versioned JSON API
The server SHALL expose its API under `/api/v1/` using JSON request and response bodies with camelCase field names. Errors SHALL be returned as `{"error": {"kind": "<kind>", "message": "<text>"}}` with status 404 for `not_found`, 400 for `invalid_input`, 409 for `duplicate`, 503 for `engine_unavailable`, 401 for `unauthorized`, and 403 for `forbidden`.

#### Scenario: Error shape
- **WHEN** a client requests `GET /api/v1/torrents/0000000000000000000000000000000000000000` for an unknown torrent
- **THEN** the response is 404 with `error.kind` = `not_found`

### Requirement: Health endpoint
`GET /api/v1/health` SHALL always be reachable without authentication and return `{"app": "torrentx", "version": "<semver>", "engine": "rqbit" | "transmission", "authRequired": <bool>}`.

#### Scenario: Identify a TorrentX server
- **WHEN** a client calls `GET /api/v1/health` on a running server with auth enabled
- **THEN** it receives 200 with `app` = `torrentx` and `authRequired` = true

### Requirement: Torrent endpoints
The server SHALL provide:
- `GET /api/v1/torrents` → array of torrents in the shared model
- `GET /api/v1/torrents/{id}` → one torrent plus `files`
- `POST /api/v1/torrents` with JSON `{"uri": "<magnet or http(s) url>"}` or `multipart/form-data` with a `file` field containing a `.torrent` → `201 {"id": "<id>"}`
- `POST /api/v1/torrents/{id}/pause` and `/resume` → 204
- `DELETE /api/v1/torrents/{id}?deleteData=true|false` → 204 (default `false`)

#### Scenario: Add by magnet
- **WHEN** a client posts `{"uri": "magnet:?xt=urn:btih:..."}` to `/api/v1/torrents`
- **THEN** the response is 201 with the torrent id and a subsequent list contains it

#### Scenario: Upload torrent file
- **WHEN** a client posts a multipart form with a valid `.torrent` in field `file`
- **THEN** the response is 201 with the torrent id

### Requirement: Settings endpoints
`GET /api/v1/settings` SHALL return the current settings grouped as `server` (bind, port, allowedHosts), `auth` (enabled, username), `engine` (kind, rqbit options, transmission `host`, `port`, `path`, `https`, `username`, `hasPassword`), `network` (maxConnectionsPerTorrent, maxUploadKBps, maxDownloadKBps, listenPort, upnp, proxy {type, host, port, authRequired, username, hasPassword}), `downloads` (defaultSavePath, createSubfolder, moveCompletedEnabled, moveCompletedPath, maxActiveDownloads, maxActiveTorrents, startAutomatically, defaultPriority, seedAutomatically, minRatio, minSeedingMinutes), `advanced` (diskCacheMB, osCache, superSeeding, dht, pex, lpd, anonymousMode, sequentialDownload, webSocketTrackers) and `preferences` (see `app-preferences`). It SHALL NOT return any password or password hash. `PUT /api/v1/settings` SHALL validate, persist to the config file, and apply the new settings. Engine kind/connection changes SHALL take effect immediately (old engine stopped, new one started); network, downloads and advanced values SHALL be pushed to the running engine without restarting the server, restarting only the engine when the engine requires it. Bind address or port changes SHALL be persisted and the response SHALL include `"restartRequired": true`. A config file written by the previous version (Transmission `url`) SHALL be migrated on load.

#### Scenario: Switch engine live
- **WHEN** a client PUTs settings changing the engine from `rqbit` to `transmission`
- **THEN** the response is 200, and the next `GET /api/v1/health` reports `engine` = `transmission`

#### Scenario: Change port
- **WHEN** a client PUTs settings changing the port
- **THEN** the response contains `restartRequired: true`, the config file holds the new port, and the server keeps serving on the old port until restarted

#### Scenario: Invalid settings rejected
- **WHEN** a client PUTs an engine of `transmission` with an empty host, or a port outside 1–65535
- **THEN** the response is 400 `invalid_input` and nothing is persisted

#### Scenario: Password never leaks
- **WHEN** auth is enabled and a client GETs settings
- **THEN** the body contains the username but no password or hash field

#### Scenario: Legacy config migrated
- **WHEN** the server starts with a config containing `transmission.url = "http://nas:9091/transmission/rpc"`
- **THEN** GET settings returns host `nas`, port 9091, path `/transmission/rpc`, https false

### Requirement: Optional authentication
Authentication SHALL be disabled by default. When enabled in settings with a username and password, every `/api/v1/*` endpoint except `health`, `auth/login`, and `auth/logout` SHALL require either a valid session cookie obtained from `POST /api/v1/auth/login` (`{"username","password"}`) or an HTTP Basic `Authorization` header with the same credentials. Passwords SHALL be stored only as a salted slow hash. Enabling auth via `PUT /api/v1/settings` SHALL require the new password in the request; the caller's current session SHALL remain valid afterwards.

#### Scenario: Default no auth
- **WHEN** a fresh server with default config receives `GET /api/v1/torrents` from localhost
- **THEN** it responds 200

#### Scenario: Auth required
- **WHEN** auth is enabled and a request without cookie or Basic header calls `GET /api/v1/torrents`
- **THEN** the response is 401 `unauthorized`

#### Scenario: Login
- **WHEN** a client posts correct credentials to `/api/v1/auth/login`
- **THEN** the response sets an HttpOnly, SameSite=Strict session cookie and subsequent requests with it succeed

#### Scenario: Wrong password
- **WHEN** a client posts wrong credentials to `/api/v1/auth/login`
- **THEN** the response is 401 and no cookie is set

#### Scenario: Scripted Basic auth
- **WHEN** auth is enabled and `curl -u user:pass http://127.0.0.1:9977/api/v1/torrents` is run
- **THEN** it returns the torrent list

### Requirement: Browser attack protections
Regardless of auth settings, the server SHALL reject (403 `forbidden`) any request whose `Host` header is not in the allowed host list — by default `localhost`, `127.0.0.1`, `[::1]` (with any port) when bound to a loopback address, plus any hosts the user adds in settings; when bound to a non-loopback address all hosts are allowed. The server SHALL reject (403) any state-changing request (POST/PUT/DELETE) whose `Origin` header is present and does not match the request's own scheme+host+port. The server SHALL NOT send permissive CORS headers.

#### Scenario: DNS rebinding blocked
- **WHEN** the server is bound to `127.0.0.1` and receives a request with `Host: evil.example:9977`
- **THEN** it responds 403

#### Scenario: Cross-site write blocked
- **WHEN** a page on `https://evil.example` makes a browser POST to `http://127.0.0.1:9977/api/v1/torrents`
- **THEN** the server responds 403 and no torrent is added

#### Scenario: Same-origin write allowed
- **WHEN** the web UI served from `http://127.0.0.1:9977/` POSTs to `/api/v1/torrents`
- **THEN** the request is processed normally

### Requirement: Extended torrent endpoints
In addition to the existing torrent endpoints, the server SHALL provide:
- `GET /api/v1/torrents/{id}` returning the extended details model (`torrent-engine`), plus `GET /api/v1/torrents/{id}/peers` (with `country` ISO code or null) and `GET /api/v1/torrents/{id}/pieces` (`{"count": n, "bitfield": "<base64>"}`)
- `POST /api/v1/torrents/preview` (same body forms as add) → metadata preview `{id, name, size, pieceSize, pieces, createdAt, createdBy, comment, trackers, files[{index, path, size}]}` without adding the torrent
- `POST /api/v1/torrents` accepting optional `savePath`, `createSubfolder`, `paused`, `priority`, `wantedFiles` (indices) alongside `uri`/`file`
- `POST /api/v1/torrents/{id}/verify`, `/relocate` `{"path", "moveData": true}`, `/rename` `{"name"}`, `/trackers` `{"url"}` → 204
- `PUT /api/v1/torrents/{id}/files` `{"indices": [..], "wanted"?: bool, "priority"?: "low"|"normal"|"high"}` → 204
- `GET /api/v1/torrents/{id}/magnet` → `{"uri"}`; `GET /api/v1/torrents/{id}/torrent-file` → `application/x-bittorrent` attachment
- `POST /api/v1/torrents/{id}/reveal` → opens the torrent's location in the file manager of the machine running the server; allowed only for requests from a loopback peer, otherwise 403 `forbidden`
- `POST /api/v1/transmission/test` with Transmission connection fields → 204 or the engine error, without persisting
All mutations SHALL be subject to the existing auth, Host and Origin guards. An operation the active engine cannot perform SHALL fail with 501 `unsupported`.

#### Scenario: Preview does not add
- **WHEN** a client posts a magnet to `/torrents/preview`
- **THEN** the response lists the files and a following `GET /torrents` does not contain that id

#### Scenario: Reveal from remote browser
- **WHEN** a request from a non-loopback address posts `/torrents/{id}/reveal`
- **THEN** the response is 403 `forbidden` and nothing is opened

#### Scenario: Unsupported per-file priority
- **WHEN** the active engine cannot set file priority and a client PUTs `priority: "high"`
- **THEN** the response is 501 with error kind `unsupported`

### Requirement: Tabs endpoints
The server SHALL provide `GET /api/v1/tabs` → `[{id, name, torrentIds[]}]` (user tabs only), `POST /api/v1/tabs` `{"name"}` → 201 tab, `PATCH /api/v1/tabs/{id}` `{"name"}`, `DELETE /api/v1/tabs/{id}` → 204, and `PUT /api/v1/torrents/{id}/tab` `{"tabId": "<id>" | null}` → 204.

#### Scenario: Assign torrent
- **WHEN** a client PUTs `{"tabId": "t1"}` for a torrent
- **THEN** `GET /api/v1/tabs` lists that torrent id under `t1` only

### Requirement: Stats and capabilities endpoints
The server SHALL provide `GET /api/v1/stats` (see `system-stats`) and `GET /api/v1/capabilities` (see `engine-capabilities`); `GET /api/v1/health` SHALL additionally report the server version used by the update check.

#### Scenario: Capabilities follow engine
- **WHEN** the engine is switched to Transmission
- **THEN** the next `GET /api/v1/capabilities` reflects Transmission's feature set
