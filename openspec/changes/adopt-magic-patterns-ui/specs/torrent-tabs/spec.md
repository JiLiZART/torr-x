## Purpose

User-defined torrent tabs stored by the server so that tab names and torrent membership are identical in every browser and in the desktop window.

## ADDED Requirements

### Requirement: Persistent user tabs
The server SHALL persist user tabs (id, name, order) and a torrent→tab assignment (at most one tab per torrent) in its state directory, surviving server restarts and engine switches. Built-in tabs (All, Downloading, Completed) SHALL NOT be stored or deletable.

#### Scenario: Survives restart
- **WHEN** a tab "Linux" with two torrents exists and the server restarts
- **THEN** `GET /api/v1/tabs` returns "Linux" with the same two torrent ids

### Requirement: Tab lifecycle
Creating a tab SHALL require a non-empty name after trimming (the UI supplies "Tab N" for empty input). Deleting a tab SHALL unassign its torrents (the torrents themselves are untouched). Removing a torrent SHALL remove its assignment. Assignments for torrents unknown to the current engine SHALL be kept but not listed.

#### Scenario: Delete tab
- **WHEN** a tab with assigned torrents is deleted
- **THEN** the torrents remain in All Torrents and are no longer assigned

#### Scenario: Blank name rejected
- **WHEN** a client posts a tab named `"   "`
- **THEN** the response is 400 `invalid_input`
