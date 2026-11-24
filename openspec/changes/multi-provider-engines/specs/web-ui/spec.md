## ADDED Requirements

### Requirement: Providers settings section
The settings screen SHALL have a Providers section listing every provider in order with its glyph, name, id,
kind, status (running / unavailable with the error / disabled), version, torrent count and a "default" marker.
It SHALL let the user add a provider (kind, name, id prefilled from the name and editable until saved, connection
fields, "Test connection", "Let TorrentX manage this daemon's settings"), edit, enable/disable, make default,
create a provider tab, and delete with a confirmation stating that the daemon keeps its torrents. The built-in
provider SHALL show its download directory and SHALL offer no delete action. Actions the server would reject
(deleting the built-in, disabling the last enabled provider) SHALL be disabled with the reason.

#### Scenario: Add a qBittorrent provider
- **WHEN** the user adds kind qBittorrent named "Seedbox" with host and credentials, tests and saves
- **THEN** the test result is shown before saving, and after saving `seedbox` appears as running with its
  torrent count

#### Scenario: Built-in cannot be deleted
- **WHEN** the user opens the built-in provider's actions
- **THEN** there is no delete action, and disable is disabled while it is the only enabled provider

### Requirement: Provider glyph in the torrent list
When more than one provider is enabled, each torrent row SHALL show, before the name, a monochrome glyph for its
provider's kind (one glyph per kind, drawn in theme tokens, not vendor logos) with the provider name and id in
its tooltip and accessible label. Clicking the glyph SHALL add `provider:<id>` to the lens; its menu SHALL
offer "Create tab" for that provider. When only one provider is enabled, the glyph SHALL be hidden and the row
layout SHALL be unchanged. The details view SHALL always name the torrent's provider.

#### Scenario: Mixed library
- **WHEN** providers `rqbit` and `nas` are enabled
- **THEN** rqbit rows and nas rows show different glyphs, and hovering a nas glyph shows "NAS (nas)"

#### Scenario: Glyph adds a lens chip
- **WHEN** the user clicks the glyph of a `nas` row
- **THEN** a `provider:nas` chip is added to the lens and only nas torrents are listed

#### Scenario: Single provider
- **WHEN** only `rqbit` is enabled
- **THEN** no provider glyph is rendered and rows look as before

### Requirement: Add target provider
The add flow SHALL show a provider picker listing the enabled providers, preselecting the default provider.
The preview, the options' supported state and the free-space figure SHALL follow the picked provider; options
the picked provider does not support SHALL be disabled with "not supported by <provider name>". When the picked
provider already has the torrent, the add action SHALL be disabled with a note naming the existing torrent.
With one enabled provider the picker SHALL be hidden.

#### Scenario: Pick a provider
- **WHEN** the user pastes a magnet, picks "NAS" and chooses "Add & start"
- **THEN** the torrent is added to `nas` and appears with the nas glyph

#### Scenario: Already present in the picked provider
- **WHEN** the picked provider already has the magnet's info-hash
- **THEN** "Add & start" and "Add paused" are disabled with a note linking to the existing torrent

### Requirement: Partial availability banner
When some enabled providers are unavailable and others are reachable, the UI SHALL keep listing the reachable
providers' torrents and SHALL show a dismissible banner naming each unavailable provider with its error and a
link to the Providers settings section. Tab counts and the status bar SHALL count only listed torrents. The
banner SHALL reappear when the set of unavailable providers changes.

#### Scenario: One provider down
- **WHEN** provider `nas` becomes unreachable while `rqbit` runs
- **THEN** nas torrents leave the list, rqbit torrents keep refreshing, and a banner reads that NAS is
  unavailable with its error

#### Scenario: Provider back
- **WHEN** `nas` becomes reachable again
- **THEN** its torrents return to the list and the banner disappears
