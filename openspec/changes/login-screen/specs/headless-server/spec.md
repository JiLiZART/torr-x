## ADDED Requirements

### Requirement: Auth reset command
The server binary SHALL provide an `auth reset` command that, given the same `--config` option as the server,
disables authentication in that configuration file and removes the stored password hash, so that a lost password
can be recovered by someone with access to the host. It SHALL print what it changed and that the running server
must be restarted for it to take effect. When the configuration binds to a non-loopback address it SHALL refuse,
explaining that this would expose the UI without a password, unless `--force` is given. It SHALL NOT start the
server.

#### Scenario: Reset a lost password
- **WHEN** the operator runs `torrentx-server auth reset` on a loopback-bound installation and restarts the
  service
- **THEN** the UI opens without a sign-in screen and a new password can be set in Settings

#### Scenario: Exposed installation
- **WHEN** the configuration binds to `0.0.0.0` and the operator runs `torrentx-server auth reset`
- **THEN** the command changes nothing, explains why and mentions `--force`

#### Scenario: Auth already off
- **WHEN** authentication is already disabled
- **THEN** the command says so and exits successfully without modifying the file
