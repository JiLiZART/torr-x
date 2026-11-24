## ADDED Requirements

### Requirement: Seeding obligation display
The detail hero and the torrent row SHALL state the seeding obligation in words: the remaining time or ratio
while `duty` is `pending` (e.g. "keep seeding — 2.3 days left", "ratio 1.1 / 2.0"), and "free to remove" when
`fulfilled`. When the seeding time comes from the server's counter rather than the engine, the display SHALL
say so. The target SHALL be editable inline (hero line and row menu) with ratio and seed-time inputs, an
"inherit global" reset, and a preview sentence of exactly when seeding will stop; saving SHALL persist one
`PUT /torrents/{id}/seed-target` with inline confirmation.

#### Scenario: What do I still owe
- **WHEN** a torrent has a 5-day seed-time target and has seeded 2.7 days
- **THEN** the hero reads "keep seeding — 2.3 days left" and the row shows the same obligation

#### Scenario: Edit the contract
- **WHEN** the user sets ratio 2.0 in the inline editor and saves
- **THEN** the preview said "will stop at ratio 2.0", the override persists across reload, and the obligation
  line recomputes against 2.0

### Requirement: Clear fulfilled torrents
The UI SHALL offer a bulk "Clear fulfilled" action on the fulfilled set of the current view (obligation group
header or a `duty:fulfilled` query). Before anything is sent, a confirmation SHALL state the torrent count,
the total bytes on disk that would be freed, and the save paths involved, and SHALL offer exactly two
actions: "Keep files" (remove torrents, leave data) and "Delete files" (remove and erase data). "Delete files"
SHALL additionally require a typed count or confirm chord — Enter alone SHALL NOT delete data. The action
SHALL report per-torrent progress, continue past individual failures, and summarize what was freed.

#### Scenario: One action, cost stated
- **WHEN** thirty fulfilled torrents totaling 412 GB are cleared with "Delete files" after the typed
  confirmation
- **THEN** the confirmation showed "30 torrents · 412 GB · /data/downloads" before sending, and the summary
  reports the freed bytes

#### Scenario: Keep files is not delete
- **WHEN** the user chooses "Keep files"
- **THEN** the torrents leave the library and every byte stays on disk

#### Scenario: Partial failure
- **WHEN** one of the thirty removals fails
- **THEN** the other twenty-nine still complete and the summary names the failed torrent and its error
