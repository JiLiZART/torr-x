## ADDED Requirements

### Requirement: Port test endpoint
`POST /api/v1/network/port-test` SHALL ask the engine whether its incoming port is reachable from the internet
and respond `{"open": true | false | null}`; when the active engine cannot test this it SHALL fail with 501
`unsupported`. It SHALL be subject to the existing auth, Host and Origin guards.

#### Scenario: Reachable
- **WHEN** the engine supports the test and the port is reachable
- **THEN** the response is `{"open": true}`

#### Scenario: Port test unsupported
- **WHEN** the active engine has no reachability test
- **THEN** the response is 501 with error kind `unsupported`

### Requirement: Encryption setting and DHT node count
Settings SHALL include `network.encryption` (`preferred` | `required` | `tolerated`, default `preferred`), applied
by engines that report the `encryption` capability. `GET /api/v1/stats` SHALL include `dhtNodes`, the number of
nodes in the engine's DHT routing tables, or `null` when the engine does not report it or DHT is off.

#### Scenario: DHT nodes on Transmission
- **WHEN** the active engine is Transmission
- **THEN** `dhtNodes` is `null`
