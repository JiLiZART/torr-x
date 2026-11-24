## Purpose

Server-stored labels on torrents, so that a query can address a user-defined group without the user having to
assign torrents to a single tab by hand.

## ADDED Requirements

### Requirement: Torrent tags
The server SHALL persist a set of tags per torrent in its state directory. A torrent MAY carry several tags. Tags
SHALL be trimmed, lowercased and deduplicated on write, limited to 64 characters each and 32 per torrent; a tag
that is empty after trimming SHALL be rejected with 400 `invalid_input`. Tags SHALL survive server restarts and
engine switches, and SHALL be removed with the torrent.

#### Scenario: Multiple tags
- **WHEN** the user tags a torrent `4k` and `movies`
- **THEN** `GET /api/v1/torrents` reports both tags for it and `tag:4k` and `tag:movies` both match it

#### Scenario: Normalized on write
- **WHEN** a client writes the tags `[" 4K ", "4k", "Movies"]`
- **THEN** the stored tags are `["4k", "movies"]`

#### Scenario: Removed with the torrent
- **WHEN** a tagged torrent is removed
- **THEN** its tags are dropped from the state file

### Requirement: Tag editing from the UI
The UI SHALL let the user add and remove tags on one torrent or on a multi-torrent selection, with completion
over existing tags, and SHALL offer "Add tag to all matches" for the current query. Renaming a tag SHALL update
every torrent carrying it; it SHALL NOT rewrite stored tab queries, which keep referring to the old name until
the user edits them.

#### Scenario: Tag a selection
- **WHEN** the user selects three torrents and adds the tag `linux`
- **THEN** all three report the tag after the next refresh
