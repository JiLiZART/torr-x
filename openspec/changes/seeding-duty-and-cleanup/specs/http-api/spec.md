## ADDED Requirements

### Requirement: Seed target endpoints
`PUT /torrents/{id}/seed-target` SHALL set a per-torrent seeding target `{minRatio?, minSeedTimeSecs?}` that
replaces the global downloads policy target for that torrent; an empty object SHALL mean "seed without
limit"; a `null` body SHALL reset the torrent to inherit the global target. Values SHALL be finite and ≥ 0 or
the request fails with `invalid_input`. `GET /torrents` SHALL return each torrent's effective `seedTarget`
with an `override` flag, `seededSecs` (engine-reported, or accumulated by the server while the torrent is
observed seeding, `null` when neither exists) and `duty`: `pending` (complete, effective target not met),
`fulfilled` (complete, target met) or `none` (incomplete, or no target). Targets and accumulated seeding
seconds SHALL persist across restarts.

#### Scenario: Per-torrent override
- **WHEN** the global min ratio is 1.0 and a torrent's target is set to `{minRatio: 2.0}`
- **THEN** the policy keeps it seeding past ratio 1.0 and stops it within one policy interval after ratio 2.0

#### Scenario: Inherit again
- **WHEN** a torrent with an override receives a `null` seed-target body
- **THEN** its effective target is the global one and `override` is `false`

#### Scenario: Seeding time without engine support
- **WHEN** the engine reports no seeding time and a torrent seeds for an hour under a 5-day target
- **THEN** `seededSecs` reflects the server-accumulated hour and `duty` stays `pending`

#### Scenario: Invalid target
- **WHEN** the target is `{minRatio: -1}`
- **THEN** the API responds `invalid_input` and nothing changes
