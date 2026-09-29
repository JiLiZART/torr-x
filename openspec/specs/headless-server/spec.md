# headless-server Specification

## Purpose
Defines the `torrentx-server` binary that runs a torrent engine headlessly — configurable, installable as a Linux systemd service, and hosting the web UI and HTTP API on one port.

## Requirements

### Requirement: Server binary and configuration
The project SHALL ship a `torrentx-server` executable that reads settings from a TOML config file. The path SHALL be given by `--config <path>`; if omitted, the platform user config directory (`<config_dir>/torrentx/config.toml`) is used. If the file does not exist, the server SHALL create it with defaults: bind `127.0.0.1`, port `9977`, auth disabled, engine `rqbit` with download directory `<user download dir>/TorrentX`. `--bind` and `--port` flags SHALL override the file for that run without rewriting it.

#### Scenario: First start
- **WHEN** `torrentx-server` is started with no config file present
- **THEN** it writes a default config file, starts the rqbit engine, and listens on `127.0.0.1:9977`

#### Scenario: CLI override
- **WHEN** `torrentx-server --port 8080` is run
- **THEN** it listens on port 8080 and the config file's port is unchanged

#### Scenario: Invalid config
- **WHEN** the config file contains invalid TOML or invalid values
- **THEN** the server exits non-zero with an error naming the file and the problem, and does not overwrite the file

### Requirement: Web UI hosting
The server SHALL serve the web UI from the same origin as the API: `GET /` and any non-`/api/` path without a matching asset SHALL return the UI's `index.html` (client-side routing), and static assets SHALL be served with correct content types. The UI assets SHALL be bundled into the binary so a single executable is sufficient to run.

#### Scenario: Open in browser
- **WHEN** a user opens `http://localhost:9977/` in a browser while the server runs
- **THEN** the TorrentX web UI loads and shows the torrent list

#### Scenario: Single binary
- **WHEN** only the `torrentx-server` executable is copied to another Linux machine and run
- **THEN** the web UI is served without any additional files

### Requirement: Port conflict reporting
If the configured address/port cannot be bound, the server SHALL exit non-zero with a message naming the address and port.

#### Scenario: Port in use
- **WHEN** another process already listens on the configured port
- **THEN** `torrentx-server` exits with an error mentioning the port

### Requirement: Engine failure does not kill the server
If the configured engine fails to start (e.g. Transmission unreachable, download directory not writable), the server SHALL still start the HTTP listener and web UI so the user can fix settings; torrent endpoints SHALL return `engine_unavailable` until the engine is working.

#### Scenario: Bad Transmission URL at startup
- **WHEN** the server starts with engine `transmission` pointing to an unreachable URL
- **THEN** the web UI loads, the settings screen works, and `GET /api/v1/torrents` returns 503 `engine_unavailable`

### Requirement: Graceful shutdown
On SIGINT or SIGTERM the server SHALL stop accepting requests, let the engine persist its state, and exit 0 within 10 seconds.

#### Scenario: systemd stop
- **WHEN** systemd sends SIGTERM to the running server
- **THEN** the process exits 0 and after the next start all rqbit torrents are restored

### Requirement: Linux service
The project SHALL ship a systemd unit file that runs `torrentx-server --config /etc/torrentx/config.toml` as a dedicated unprivileged user, restarts on failure, and SHALL document installation steps (create user, copy binary, enable unit).

#### Scenario: Service install
- **WHEN** an admin follows the documented steps and runs `systemctl enable --now torrentx`
- **THEN** the server runs under the unprivileged user and survives a reboot
