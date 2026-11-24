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

### Requirement: Login screen
When auth is enabled and the user is not authenticated, the UI SHALL show a sign-in screen with a password
field holding the caret, a "remember this browser for 30 days" choice and a sign-in action; on success it SHALL
show the view the user asked for. The screen SHALL have these states:
- invalid: after a wrong password it SHALL say the password is incorrect and how many attempts remain, keeping
  what was typed so it can be corrected;
- locked out: while the server refuses attempts it SHALL disable the sign-in action and show a countdown to
  when it can be tried again, re-enabling on its own;
- session expired: when a signed-in user's session ends, it SHALL say so and, after signing in, return to the
  view the user was on.
The screen SHALL say how to reset a lost password from the host, and SHALL state that the connection is not
encrypted when it is served over plain HTTP to a non-loopback address. When auth is disabled, no sign-in screen
SHALL ever appear. The desktop window SHALL NOT show it. The UI SHALL offer a Log out action when auth is
enabled.

#### Scenario: Session expired
- **WHEN** any API call returns 401 while the user is on a torrent's Peers section
- **THEN** the UI shows the sign-in screen saying the session expired, and after signing in returns to that
  Peers section

#### Scenario: Wrong password
- **WHEN** the user submits a wrong password
- **THEN** the screen says it is incorrect and shows the remaining attempts, and the typed password is still in
  the field

#### Scenario: Locked out
- **WHEN** the server answers that sign-in is locked for 47 seconds
- **THEN** the sign-in action is disabled with a countdown from 47 s and becomes available when it reaches zero

#### Scenario: Remember this browser
- **WHEN** the user signs in with "remember" checked, closes the browser and opens the UI the next day
- **THEN** no sign-in is required

#### Scenario: Not remembered
- **WHEN** the user signs in without "remember" and restarts the browser
- **THEN** the sign-in screen is shown again

#### Scenario: Auth disabled
- **WHEN** auth is off
- **THEN** the UI opens directly on the list and never shows the sign-in screen

## ADDED Requirements

### Requirement: First-run setup
When the server reports that setup has not been completed, the UI SHALL show a setup flow instead of the list,
in three steps with a visible step indicator: Engine (the embedded engine, or a Transmission connection that can
be tested), Library (the download folder, validated as existing or creatable and writable with its free space
shown; an optional folder to move completed downloads to; and a checklist of starting tabs, each shown with its
query), and Access (reachable from this machine only — the default — or from the network, which SHALL require
setting a password in that step). The flow SHALL offer Back, Continue and "Skip — use defaults" on every step,
SHALL NOT change anything on the server before the user finishes or skips, SHALL NOT start any download, and
SHALL state that everything it sets can be changed later in Settings. After finishing or skipping, the UI SHALL
show the main window and the setup SHALL NOT appear again, in any browser. An installation that was configured
before this feature existed SHALL never show it.

#### Scenario: Fresh install
- **WHEN** the UI is opened against a server that has never been set up
- **THEN** the setup flow is shown at its first step

#### Scenario: Skip
- **WHEN** the user chooses "Skip — use defaults"
- **THEN** the main window opens with the default download folder, the default tabs and loopback-only access,
  and reloading does not show the setup again

#### Scenario: Unwritable folder
- **WHEN** the user enters a download folder that cannot be written to
- **THEN** the step says so next to the field and Continue is unavailable

#### Scenario: Choose starting tabs
- **WHEN** the user unchecks "Stalled", keeps the rest and finishes
- **THEN** the sidebar shows exactly the checked tabs with the queries that were displayed

#### Scenario: Network access needs a password
- **WHEN** the user chooses access from the network
- **THEN** a password is required before the flow can be finished

#### Scenario: Abandoned setup changes nothing
- **WHEN** the user closes the page on step 2
- **THEN** the server's settings are unchanged and the setup starts again at step 1 next time

#### Scenario: Upgraded install
- **WHEN** a server with an existing configuration is upgraded
- **THEN** the setup flow is not shown
