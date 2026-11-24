## ADDED Requirements

### Requirement: Setup endpoints
`GET /api/v1/health` SHALL include `setupRequired`: true on a server whose configuration was created by default
and never confirmed, false otherwise, and always false for a configuration that existed before this field was
introduced. `POST /api/v1/setup` SHALL accept any subset of `{engine, downloadDir, moveCompleted, tabs: [{name,
query, pinned}], access: {bind, auth: {username, password}}}`, validate all of it before changing anything,
apply it as one change, mark setup as completed and respond like `PUT /api/v1/settings` (including
`restartRequired`). An empty body SHALL complete setup with the current defaults. When `tabs` is given, the
server's tabs SHALL be exactly those, in order. A non-loopback `access.bind` without `auth` SHALL be rejected
with 400 `invalid_input`. Once setup is completed the endpoint SHALL respond 409 `conflict`. The API SHALL work
with defaults whether or not setup has been completed.

#### Scenario: Fresh server
- **WHEN** a server starts with no configuration file
- **THEN** `GET /api/v1/health` reports `setupRequired: true` and `GET /api/v1/torrents` responds 200

#### Scenario: Complete with defaults
- **WHEN** a client posts `{}` to `/api/v1/setup`
- **THEN** the response is 200, settings are unchanged and `setupRequired` is false afterwards

#### Scenario: Invalid input changes nothing
- **WHEN** a client posts a valid `downloadDir` together with `access.bind: "0.0.0.0"` and no `auth`
- **THEN** the response is 400 `invalid_input`, the download directory is unchanged and `setupRequired` is still
  true

#### Scenario: Only once
- **WHEN** a client posts to `/api/v1/setup` after setup was completed
- **THEN** the response is 409 `conflict`

#### Scenario: Existing configuration
- **WHEN** a server starts with a configuration file written by an earlier version
- **THEN** `setupRequired` is false

### Requirement: Path check endpoint
`POST /api/v1/fs/check` `{"path"}` SHALL respond `{exists, isDir, writable, freeBytes}` for that path on the
server's machine, where `writable` is true when the directory, or its nearest existing ancestor if it does not
exist yet, can be written to, and `freeBytes` is null when unknown; it SHALL NOT create anything and SHALL NOT
list directory contents. It SHALL be subject to the existing auth, Host and Origin guards.

#### Scenario: Writable folder that does not exist yet
- **WHEN** a client checks a path whose parent exists and is writable
- **THEN** the response is `exists: false, writable: true` and the folder is not created

#### Scenario: Read-only location
- **WHEN** a client checks a directory the server cannot write to
- **THEN** the response has `writable: false`
