## ADDED Requirements

### Requirement: Frameless window
The main window SHALL be created without native decorations (no OS title bar or native window buttons) on macOS, Windows and Linux, keeping the OS shadow where available, resizable, with a minimum size of 900×600. Window controls are provided by the web UI header; closing via the red dot SHALL hide the window to the tray exactly like the former native close. The window SHALL grant the loaded server origin only the window permissions needed for close/hide, minimize, toggle maximize and dragging.

#### Scenario: No native title bar
- **WHEN** the desktop app shows its window
- **THEN** there is no native title bar and the header dots are the only window buttons

#### Scenario: Red dot hides
- **WHEN** the user clicks the red dot
- **THEN** the window hides and the app keeps running in the tray

#### Scenario: No other IPC
- **WHEN** page script in the window invokes any Tauri command other than those window operations
- **THEN** the call is denied

### Requirement: Autostart and start minimized
The desktop app SHALL register/unregister itself as an OS login item according to the "start with system" preference (applied at launch and whenever the setting changes while the app runs). When "start minimized" is on, the app SHALL start with the window hidden (tray only).

#### Scenario: Enable autostart
- **WHEN** the user enables "Start TorrentX with system" in settings
- **THEN** the OS login items list TorrentX, and disabling removes it

#### Scenario: Start minimized
- **WHEN** start minimized is on and the app launches
- **THEN** no window is shown until the user clicks the tray icon

### Requirement: Quit confirmation
When "confirm exit while downloading" is on and at least one torrent is downloading, Quit (tray or Cmd+Q) SHALL show a native confirmation dialog; cancelling keeps the app running.

#### Scenario: Cancel quit
- **WHEN** a torrent is downloading and the user chooses Quit then Cancel
- **THEN** the app and server keep running

### Requirement: Native notifications
When desktop notifications are enabled, the desktop app SHALL show native OS notifications for torrent completion and/or addition per preferences, and play the completion sound if enabled; the web UI inside the desktop window SHALL NOT also show browser notifications for the same events. Notifications SHALL work while the window is hidden.

#### Scenario: Completion while hidden
- **WHEN** the window is hidden and a torrent completes
- **THEN** one native notification is shown

### Requirement: Show in file manager
When the server runs in-process or on the same machine, "Show in file manager" SHALL open the OS file manager at the torrent's location.

#### Scenario: Reveal
- **WHEN** the user picks "Show in file manager" in the desktop window
- **THEN** Finder/Explorer/the default file manager opens at the torrent's folder
