## ADDED Requirements

### Requirement: Duty field
The query language SHALL expose the field `duty:` with values `pending`, `fulfilled` and `none`, matching the
server-provided seeding obligation state, so a tab such as `duty:pending` answers "what do I still owe" and
`duty:fulfilled` collects everything that is free to remove.

#### Scenario: Obligation tab
- **WHEN** the user saves a tab with query `duty:pending`
- **THEN** it lists exactly the completed torrents still below their effective seeding target

#### Scenario: Cleanup set
- **WHEN** the user enters `duty:fulfilled tag:4k`
- **THEN** only fulfilled torrents tagged `4k` match
