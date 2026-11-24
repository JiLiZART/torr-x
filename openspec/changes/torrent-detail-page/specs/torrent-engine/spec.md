## ADDED Requirements

### Requirement: Tracker, peer and web-seed detail
The engine-agnostic details model SHALL describe each tracker with its tier, kind (a real tracker, or the DHT,
peer-exchange and local-discovery sources when the engine reports them as peer sources), leecher count, bytes
downloaded as reported by the tracker and the failure message of its last announce; each peer with its
connection encryption; and the torrent's web seeds with URL, status, download rate, bytes downloaded and failure
message. Tracker status SHALL be normalized by each engine to `working`, `updating`, `not working` or `disabled`.
Every one of these values SHALL be optional: an engine SHALL report only what it actually knows and leave the
rest absent, and SHALL report web seeds as absent — not as an empty list — when it has no notion of them.
Both engines SHALL offer re-announce and add-web-seed operations that return the `unsupported` error kind when
the engine cannot perform them.

#### Scenario: Transmission tracker tiers
- **WHEN** a Transmission torrent has trackers in tiers 0 and 1
- **THEN** the details report those tiers and each tracker's last announce result

#### Scenario: Engine without web seeds
- **WHEN** the engine has no web-seed information
- **THEN** web seeds are absent from the details and the add-web-seed operation returns `unsupported`

#### Scenario: Status vocabulary
- **WHEN** two engines describe a failed announce in different words
- **THEN** both report status `not working` and carry their own wording as the failure message
