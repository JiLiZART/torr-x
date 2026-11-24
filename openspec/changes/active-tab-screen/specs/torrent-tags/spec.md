## Purpose

Server-stored, many-per-torrent labels that replace manual tab membership and are queryable as `tag:`.

## ADDED Requirements

### Requirement: Torrent tags
Each torrent SHALL carry a set of tags stored by the server (normalized: trimmed, lowercased, deduplicated;
at most 32 tags of ≤ 64 characters per torrent). `PUT /torrents/{id}/tags` SHALL replace the set; tags SHALL
persist across restarts and engine switches, and SHALL be returned on every `Torrent`.

#### Scenario: Set and query
- **WHEN** tags `["4k", "movies"]` are set on a torrent
- **THEN** `tag:4k` matches it and the row shows both chips

#### Scenario: Normalization
- **WHEN** tags `[" 4K ", "4k", "Movies"]` are submitted
- **THEN** the stored set is `["4k", "movies"]`

#### Scenario: Limit
- **WHEN** a 33rd tag is submitted
- **THEN** the API responds `invalid_input` and nothing changes
