## Purpose

Lets one TorrentX server drive several torrent engines at once — the built-in rqbit plus any number of remote
daemons — and present their torrents as one library with provider-scoped ids.

## ADDED Requirements

### Requirement: Provider registry
The server SHALL keep an ordered list of providers, each `{id, name, kind, enabled}` plus kind-specific
connection fields. `kind` SHALL be one of `rqbit`, `transmission`, `qbittorrent`. `id` SHALL be 1–32 characters
of `a-z`, `0-9` and `-`, unique, and immutable after creation; `name` SHALL be a free display label. Exactly one
enabled provider SHALL be the default provider. Several providers MAY have the same kind.

#### Scenario: Two Transmission daemons
- **WHEN** the user adds providers `nas` and `seedbox`, both of kind `transmission`
- **THEN** both are listed with their own status and their torrents appear in one list

#### Scenario: Invalid id rejected
- **WHEN** a provider is created with id `My NAS`
- **THEN** the request fails with `invalid_input` and nothing is persisted

#### Scenario: Duplicate id rejected
- **WHEN** a provider is created with an id that already exists
- **THEN** the request fails with `duplicate`

### Requirement: Built-in rqbit provider
The provider `{id: "rqbit", kind: "rqbit"}` SHALL always exist, run in-process and use the configured download
directory. It SHALL NOT be deletable and SHALL NOT have a second instance; it MAY be disabled, in which case
the in-process engine is stopped and its torrents are not listed. Only `rqbit` may have kind `rqbit`.

#### Scenario: Delete built-in refused
- **WHEN** a client deletes provider `rqbit`
- **THEN** the request fails with `invalid_input` and the provider remains

#### Scenario: Disable built-in
- **WHEN** the user disables the built-in provider while a Transmission provider is enabled and default
- **THEN** rqbit torrents disappear from the list, Transmission torrents remain, and after re-enabling the
  rqbit torrents are listed again with their previous state

### Requirement: Scoped torrent ids
Every torrent SHALL be identified as `<providerId>:<infoHash>` with the info-hash in lowercase hex, and SHALL
carry `provider` (the provider id) and `infoHash`. The same info-hash MAY exist in several providers as distinct
torrents. Wherever a torrent id is accepted, a bare info-hash SHALL resolve to the torrent when exactly one
enabled provider has it, SHALL fail with `not_found` when none has it, and SHALL fail with `invalid_input`
naming the matching scoped ids when several have it.

#### Scenario: Cross-seeded torrent
- **WHEN** providers `rqbit` and `nas` both have info-hash `ab12…`
- **THEN** the list contains `rqbit:ab12…` and `nas:ab12…` as two rows

#### Scenario: Bare hash, one match
- **WHEN** only `nas` has info-hash `cd34…` and a client pauses `cd34…`
- **THEN** `nas:cd34…` is paused

#### Scenario: Bare hash, ambiguous
- **WHEN** two providers have info-hash `ab12…` and a client pauses `ab12…`
- **THEN** the request fails with `invalid_input` listing `rqbit:ab12…` and `nas:ab12…`, and nothing is paused

### Requirement: Default provider and add target
A torrent add SHALL go to the provider named in the request, or to the default provider when none is named.
Naming a disabled or unknown provider SHALL fail with `invalid_input`. Adding an info-hash that the target
provider already has SHALL fail with `duplicate`; other providers having it SHALL NOT block the add.

#### Scenario: Default target
- **WHEN** the default provider is `nas` and a magnet is added without `provider`
- **THEN** the torrent is added to `nas` and its id starts with `nas:`

#### Scenario: Same hash elsewhere
- **WHEN** `rqbit` has info-hash `ab12…` and the same magnet is added with `provider: "nas"`
- **THEN** the add succeeds with id `nas:ab12…`

### Requirement: Provider availability isolation
Each enabled provider SHALL be started and polled independently with a bounded per-call wait (at most 5 s).
A provider that fails to start, is unreachable or exceeds the wait SHALL be reported with status `unavailable`
and its error message, and SHALL NOT delay or fail requests for torrents of other providers. Torrent listing
SHALL return the torrents of every reachable provider and SHALL fail with `engine_unavailable` only when no
enabled provider is reachable. Operations on a torrent of an unavailable provider SHALL fail with
`engine_unavailable` naming that provider.

#### Scenario: One daemon down
- **WHEN** provider `nas` is unreachable and `rqbit` is running
- **THEN** listing returns the rqbit torrents within the normal refresh time, and `nas` reports `unavailable`
  with its error

#### Scenario: All down
- **WHEN** every enabled provider is unreachable
- **THEN** listing fails with `engine_unavailable`

### Requirement: Provider lifecycle
Creating, editing, enabling, disabling or deleting a provider SHALL take effect without restarting the server:
only the affected provider is started, restarted or stopped. Deleting a remote provider SHALL NOT remove
anything from its daemon; TorrentX's own data for its torrents (tags, name overrides, policy state) SHALL be
dropped. Deleting the default provider SHALL make the built-in provider default if enabled, else the first
enabled provider; deleting or disabling the last enabled provider SHALL be rejected with `invalid_input`.

#### Scenario: Edit one provider
- **WHEN** the user changes the host of provider `nas`
- **THEN** only `nas` reconnects and rqbit transfers continue uninterrupted

#### Scenario: Delete keeps remote data
- **WHEN** provider `seedbox` is deleted
- **THEN** its torrents disappear from TorrentX and remain in the seedbox daemon

#### Scenario: Last provider protected
- **WHEN** only `rqbit` is enabled and the user disables it
- **THEN** the request fails with `invalid_input` and `rqbit` stays enabled

### Requirement: Managed settings per provider
The global network, downloads and advanced settings SHALL apply to the built-in provider and to each remote
provider whose `manageSettings` flag is true; remote providers with `manageSettings` false SHALL keep the
daemon's own settings untouched. `manageSettings` SHALL default to false for providers added by the user.

#### Scenario: Unmanaged daemon untouched
- **WHEN** provider `seedbox` has `manageSettings: false` and the user changes the global download limit
- **THEN** rqbit applies the new limit and the seedbox daemon's limit is unchanged

### Requirement: Single-engine configuration migrates
On load, a configuration written by a version with one engine (`engine.kind` = `rqbit` or `transmission`)
SHALL migrate to providers: the built-in provider always exists; a `transmission` engine becomes provider
`{id: "transmission", name: "Transmission", manageSettings: true}`, enabled and default, with the built-in
provider disabled. Stored tags, name overrides and policy state SHALL move to scoped ids of the provider that
was active. The migrated configuration and state SHALL be written back.

#### Scenario: Former Transmission user
- **WHEN** a config with `engine.kind = "transmission"` and host `nas` is loaded and a torrent `ab12…` had tag
  `iso`
- **THEN** providers are `rqbit` (disabled) and `transmission` (enabled, default, host `nas`), and
  `transmission:ab12…` still has tag `iso`

#### Scenario: Former rqbit user
- **WHEN** a config with `engine.kind = "rqbit"` is loaded
- **THEN** the only provider is `rqbit`, enabled and default, and its torrents keep their tags as `rqbit:<hash>`
