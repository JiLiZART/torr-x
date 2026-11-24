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
