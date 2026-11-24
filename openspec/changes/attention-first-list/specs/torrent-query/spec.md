## ADDED Requirements

### Requirement: Attention field and sort
The query language SHALL expose the field `attention:` with values `needs-attention`, `seeding-duty`, `active`
and `done`, matching the server-provided class, and the sort key `sort:attention`, which orders by the class
rank (needs-attention first, then seeding-duty, active, done) with ties broken by the next sort key. The
built-in All tab SHALL default to `sort:attention,added desc` on fresh installs; a user-customized All query
SHALL NOT be rewritten by migration.

#### Scenario: Filter by attention
- **WHEN** the user enters `attention:needs-attention`
- **THEN** only torrents the server classified as needing attention match

#### Scenario: Attention-first ordering
- **WHEN** the effective query is `sort:attention,added desc`
- **THEN** a stalled torrent lists above a healthy downloading one, and two active torrents list newest first

#### Scenario: Completion
- **WHEN** the user types `atten` in any query surface
- **THEN** the shared completion source offers `attention:` with its four values
