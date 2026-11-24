## MODIFIED Requirements

### Requirement: Settings screen
The UI SHALL provide settings as a page inside the main window — not a dialog — with the sections General,
Engine, Network, Bandwidth, Queue & seeding, Folders, Tabs & query, Terminal & security, Notifications,
Appearance and About, each with its own address, containing every control listed in the `app-preferences`,
`http-api` settings and `engine-capabilities` requirements. Going back SHALL return to the view the user came
from. A search field SHALL find settings by name or description across all sections and lead to the matching
row. Each row SHALL carry a one-line explanation. Controls unsupported by the active engine SHALL stay visible,
disabled, with a "not supported by <engine>" hint.

Settings SHALL be loaded from and saved to the API without a page-wide Save button:
- an ordinary change SHALL be saved as soon as it is made, with a visible saved confirmation on that row, and
  SHALL be reverted on that row with the error when the server rejects it;
- a change that restarts the engine SHALL NOT be sent immediately: the page SHALL show a "restart required"
  notice naming what changed, with "Later" and "Restart engine", and SHALL send it when the user chooses to
  restart; leaving settings with such changes pending SHALL ask before discarding them;
- changes to authentication (on/off, username, password), bind address, port and allowed hosts SHALL be sent
  only on an explicit Apply; the UI SHALL show a notice when `restartRequired` is returned and SHALL warn before
  applying when the bind address is non-loopback while auth is disabled.
The Engine section SHALL show the current engine, its version and connection status and offer "Test connection"
for Transmission. The Network section SHALL offer a port reachability test, run only when the user asks, showing
the result and when it was obtained, and a control that picks a random port.

#### Scenario: Enable auth
- **WHEN** the user enables auth with username and password and applies
- **THEN** settings persist and the user stays logged in

#### Scenario: Exposed without auth warning
- **WHEN** the user sets bind address to `0.0.0.0` with auth disabled
- **THEN** the UI shows a warning before applying

#### Scenario: Speed limit applied
- **WHEN** the user sets maximum download speed to 100 KB/s
- **THEN** the row shows it was saved without any Save button, and the aggregate download rate settles at or
  below ~100 KB/s

#### Scenario: Test Transmission connection
- **WHEN** the user enters an unreachable host and clicks "Test connection"
- **THEN** the UI shows the failure message without saving

#### Scenario: Section address
- **WHEN** the user opens the address of the Network section, or reloads while on it
- **THEN** the settings page opens on Network

#### Scenario: Back to the tab
- **WHEN** the user opens settings from the "Active" tab and goes back
- **THEN** "Active" is shown again

#### Scenario: Engine restart is deferred
- **WHEN** the user changes the listen port from 6881 to 51413
- **THEN** a notice says a restart is required and names the change, the engine keeps running on 6881, and it
  restarts on 51413 only after the user chooses "Restart engine"

#### Scenario: Rejected value
- **WHEN** the server rejects a changed value as invalid
- **THEN** that row shows the error and returns to its previous value; other rows are unaffected

#### Scenario: Search settings
- **WHEN** the user types `proxy` in the settings search
- **THEN** the proxy rows are listed with their section, and choosing one opens that section at that row

#### Scenario: Unsupported row stays visible
- **WHEN** the active engine offers no HTTP proxy
- **THEN** the HTTP proxy row is shown disabled with "not supported by <engine>"

#### Scenario: Port test unsupported
- **WHEN** the active engine cannot test port reachability
- **THEN** the test control is disabled with the hint and no result is claimed

## ADDED Requirements

### Requirement: Settings page layout
The settings page SHALL show a breadcrumb `← <tab> ⌘[ / Settings / <section>` with the caption "changes save
automatically", a section rail with the sections General, Engine, Network, Bandwidth, Queue & seeding, Folders,
Tabs & query, Terminal & security, Notifications, Appearance, About, and a "Search settings ⌘F" field. Each
section SHALL deep-link (`tx://settings/<section>`). The Engine header SHALL show the engine name, version and
mode with the note that capabilities drive which rows are available. Rows SHALL be grouped under captions that
state scope (e.g. "restart required for port changes", "applies to new connections only").

#### Scenario: Deep link
- **WHEN** the user opens `tx://settings/network`
- **THEN** the page opens on Network with the rail highlighting it

### Requirement: Network section
The Network section SHALL offer: incoming port with an open/closed state chip and a Random action; automatic
port mapping (UPnP / NAT-PMP); a port reachability row showing the result, the age of the last check and
"Test again"; DHT with its node count, Peer exchange and Local peer discovery toggles, each explained in one
line; protocol encryption mode; and proxy type and address. Proxy types the active engine lacks (HTTP, SOCKS4
on rqbit) SHALL remain visible and disabled with "not supported by <engine>".

#### Scenario: Reachability
- **WHEN** the user presses "Test again" on an engine that supports it
- **THEN** the row shows reachable / not reachable and "just now"

#### Scenario: Restart banner as drawn
- **WHEN** the listen port is changed from 6881 to 51413
- **THEN** the banner reads that transfers keep running on the old port until the engine restarts, with Later
  and Restart engine
