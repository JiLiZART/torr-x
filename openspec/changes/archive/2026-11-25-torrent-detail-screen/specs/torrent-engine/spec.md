## ADDED Requirements

### Requirement: Extended tracker, peer and web-seed detail
Both engines SHALL fill the extended detail model where they can: tracker tier, kind (including DHT/PeX
pseudo-rows), leechers, downloaded bytes, failure text and announce schedule; peer flags and encryption;
web-seed URL, BEP kind, status, speed, downloaded and error. Anything an engine cannot report SHALL be
`null`. Neither engine SHALL synthesize values to fill the model.

#### Scenario: Transmission tracker stats
- **WHEN** Transmission reports trackerStats
- **THEN** tier, seeder/leecher counts, last/next announce and failure text map into the shared model

#### Scenario: rqbit gaps
- **WHEN** rqbit does not expose per-tracker downloaded bytes
- **THEN** that field is `null` on every tracker
