## ADDED Requirements

### Requirement: Attention and diagnosis on torrents
Every torrent returned by `GET /torrents` SHALL carry `attention`, one of `needsAttention`, `seedingDuty`,
`active`, `done`, derived by the server: an errored, stalled, tracker-rejected, disk-pressured or
needs-verify torrent is `needsAttention`; a complete torrent still below the active ratio/seed-time target is
`seedingDuty`; a downloading, checking, queued or paused-incomplete torrent is `active`; a complete torrent
with no remaining obligation is `done`. Every torrent SHALL also carry `diagnosis`: either `null` or a
structured `{code, params}` from a closed registry (e.g. `stalled-no-peers`, `tracker-rejected`, `disk-low`,
`engine-error`, `needs-verify`, `seeding-duty`). The server SHALL NOT emit a diagnosis code whose supporting
facts the engine did not report, and SHALL NOT flag a torrent as stalled within 60 seconds of it being added
or resumed.

#### Scenario: Stalled torrent
- **WHEN** a torrent has been downloading for more than 60 seconds with 0 connected peers
- **THEN** it is returned with `attention: "needsAttention"` and `diagnosis.code: "stalled-no-peers"` with the
  seed and tracker counts in `params`

#### Scenario: Nothing to say
- **WHEN** a torrent is downloading healthily and the engine reports no tracker statistics
- **THEN** `diagnosis` is `null` — no tracker claim is invented

#### Scenario: Seeding obligation
- **WHEN** the active policy targets ratio 2.0 and a completed seeding torrent is at ratio 1.1
- **THEN** its `attention` is `seedingDuty` and its diagnosis carries the remaining obligation

#### Scenario: Fresh torrent grace
- **WHEN** a magnet was added 10 seconds ago and has no peers yet
- **THEN** its `attention` is `active`, not `needsAttention`
