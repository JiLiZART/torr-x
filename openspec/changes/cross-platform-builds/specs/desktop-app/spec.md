## MODIFIED Requirements

### Requirement: Attach to existing server
Before starting its own server, the app SHALL call `GET /api/v1/health` on the configured address. If a TorrentX server answers, the app SHALL NOT start its own server and SHALL show that server's UI instead. If the port is occupied by something that is not TorrentX, the app SHALL show an error dialog naming the port and offering to open the settings file location, instead of crashing. The app SHALL report the port as occupied only on evidence: an HTTP answer that is not TorrentX's health response, or a bind that fails because the address is in use. A refused, reset or slow connection SHALL NOT count as occupied; in that case the app SHALL try to start its own server. If the operating system forbids binding the port (for example a port inside a Windows reserved range), the dialog SHALL name the port, say that the system reserves it, and tell the user how to check it or pick another port.

#### Scenario: System service already running
- **WHEN** `torrentx-server` is already running on the configured port and the app launches
- **THEN** the app's window shows that server's UI and no second engine is started

#### Scenario: Foreign process on port
- **WHEN** a non-TorrentX process listens on the configured port
- **THEN** the app shows an error dialog mentioning the port

#### Scenario: Free port on Windows
- **WHEN** nothing listens on the configured port and connection attempts to it fail slowly (as on Windows)
- **THEN** the app starts its in-process server and shows the UI, without a "used by another program" dialog

#### Scenario: Reserved port on Windows
- **WHEN** the configured port lies in a range Windows reserves and binding fails with access denied
- **THEN** the dialog names the port, says the system reserves it, and suggests `netsh interface ipv4 show excludedportrange protocol=tcp` or changing `port` in the config file
