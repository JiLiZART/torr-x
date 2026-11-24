## ADDED Requirements

### Requirement: Free space endpoint
`GET /fs/free?path=<dir>` SHALL return `{freeBytes, totalBytes, path}` for the volume holding the given
directory, resolving a not-yet-existing path to its nearest existing ancestor. The path SHALL be validated
like other filesystem inputs (absolute, no traversal); invalid paths SHALL fail with `invalid_input`. The
endpoint SHALL sit behind the same authentication and browser-attack guards as every other route.

#### Scenario: Chosen subfolder does not exist yet
- **WHEN** the add flow queries `/fs/free?path=/data/downloads/new-show` and only `/data/downloads` exists
- **THEN** the response reports the free bytes of the `/data` volume and `path: "/data/downloads"`

#### Scenario: Invalid path
- **WHEN** the path is relative or contains traversal
- **THEN** the API responds `invalid_input`

### Requirement: Add provenance
`POST /torrents` (and the preview-based add) SHALL accept an `addedBy` label (trimmed, ≤ 64 characters). The
server SHALL store it and return it as `Torrent.addedBy`; an add without a label SHALL be recorded as `api`,
and torrents added before this feature SHALL report `null`. Provenance SHALL persist in server state across
restarts and SHALL NOT be used for authorization.

#### Scenario: The robots identify themselves
- **WHEN** Sonarr adds a torrent with `addedBy: "sonarr"`
- **THEN** `GET /torrents` reports `addedBy: "sonarr"` for it

#### Scenario: Unnamed API add
- **WHEN** a script adds a torrent without `addedBy`
- **THEN** the torrent reports `addedBy: "api"`, never `you`

#### Scenario: Unknown history
- **WHEN** a torrent existed before provenance was recorded
- **THEN** its `addedBy` is `null` and nothing is invented
