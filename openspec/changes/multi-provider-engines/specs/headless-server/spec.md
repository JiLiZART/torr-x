## MODIFIED Requirements

### Requirement: Server binary and configuration
The project SHALL ship a `torrentx-server` executable that reads settings from a TOML config file. The path SHALL be given by `--config <path>`; if omitted, the platform user config directory (`<config_dir>/torrentx/config.toml`) is used. If the file does not exist, the server SHALL create it with defaults: bind `127.0.0.1`, port `9977`, auth disabled, and one provider — the built-in `rqbit` provider, enabled and default, with download directory `<user download dir>/TorrentX`. `--bind` and `--port` flags SHALL override the file for that run without rewriting it.

#### Scenario: First start
- **WHEN** `torrentx-server` is started with no config file present
- **THEN** it writes a default config file with the built-in rqbit provider, starts it, and listens on `127.0.0.1:9977`

#### Scenario: CLI override
- **WHEN** `torrentx-server --port 8080` is run
- **THEN** it listens on port 8080 and the config file's port is unchanged

#### Scenario: Invalid config
- **WHEN** the config file contains invalid TOML or invalid values (including duplicate provider ids or no enabled provider)
- **THEN** the server exits non-zero with an error naming the file and the problem, and does not overwrite the file

### Requirement: Engine failure does not kill the server
If a configured provider fails to start (e.g. a daemon unreachable, download directory not writable), the server SHALL still start the HTTP listener, the web UI and every other provider so the user can fix settings; that provider's torrents SHALL be unavailable and torrent endpoints SHALL return `engine_unavailable` only when no enabled provider is working.

#### Scenario: Bad Transmission URL at startup
- **WHEN** the server starts with only a `transmission` provider enabled, pointing to an unreachable URL
- **THEN** the web UI loads, the settings screen works, and `GET /api/v1/torrents` returns 503 `engine_unavailable`

#### Scenario: One bad provider among several
- **WHEN** the server starts with `rqbit` and an unreachable `nas` provider enabled
- **THEN** `GET /api/v1/torrents` returns 200 with the rqbit torrents and `GET /api/v1/providers` reports `nas` unavailable
