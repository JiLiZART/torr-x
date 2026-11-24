## MODIFIED Requirements

### Requirement: Seeding and queue policy
The server SHALL enforce max active downloads / max active torrents (extra torrents `queued`), stop seeding when the effective min ratio or min seeding time is reached if "seed automatically" is off or the limit is set, and move completed downloads to the configured directory — using the engine's native feature when it has one and a server-side policy loop otherwise. The effective seeding target SHALL be the torrent's per-torrent override when set (an empty override meaning no limit), and the global downloads target otherwise. Where the engine does not report accumulated seeding time, the server SHALL accumulate it while the torrent is observed seeding and enforce time-based targets from that counter.

#### Scenario: Ratio reached
- **WHEN** min ratio is 1.0 and a seeding torrent reaches ratio 1.0
- **THEN** within one policy interval (≤ 10 s) it becomes `paused`

#### Scenario: Queue limit
- **WHEN** max active downloads is 2 and a third downloading torrent is added
- **THEN** the third reports `queued` until one of the first two completes or is paused

#### Scenario: Override beats global
- **WHEN** the global min ratio is 1.0 and a torrent's override is `{minRatio: 2.0}`
- **THEN** the torrent keeps seeding at ratio 1.5 and is paused only after reaching 2.0

#### Scenario: No-limit override
- **WHEN** a torrent's override is `{}`
- **THEN** no ratio or time limit stops it, regardless of the global target
