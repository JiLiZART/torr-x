## ADDED Requirements

### Requirement: Provider field
The query language SHALL expose `provider:` as an exact, case-insensitive match on the torrent's provider id,
with `*` wildcards and `!` negation like other exact fields. Value completion SHALL offer the ids of all
configured providers, labelled with their names. `sort:provider` SHALL order by provider id. A query naming a
provider id that does not exist SHALL parse and match nothing.

#### Scenario: Filter by provider
- **WHEN** the query is `provider:nas state:seeding`
- **THEN** only seeding torrents of provider `nas` match

#### Scenario: Exclude a provider
- **WHEN** the query is `provider:!rqbit`
- **THEN** every torrent except the built-in provider's matches

#### Scenario: Provider completion
- **WHEN** the user types `provider:` with providers `rqbit` and `nas` configured
- **THEN** completion offers `rqbit` and `nas` with their names

#### Scenario: Deleted provider
- **WHEN** a tab's query is `provider:seedbox` and provider `seedbox` has been deleted
- **THEN** the tab parses without error and lists nothing
