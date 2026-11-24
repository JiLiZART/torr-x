# desktop-app Specification

## Purpose
Defines the TorrentX desktop app: a Tauri 2 tray application that runs the TorrentX server in-process (or attaches to an existing one) and shows the server's web UI in a window.

## Requirements

### Requirement: Latest Tauri 2
The desktop app SHALL build and run on the latest stable Tauri 2.x release with matching latest `@tauri-apps/cli`, `@tauri-apps/api`, and plugin versions, on macOS, Windows, and Linux.

#### Scenario: Clean build
- **WHEN** a developer runs `pnpm build:desktop` on a supported OS
- **THEN** the Tauri bundle builds without errors

### Requirement: In-process server
On launch the desktop app SHALL start the TorrentX server inside its own process using the app's config file (in the OS app-config directory, same format and defaults as the headless server). Quitting the app SHALL gracefully stop the server and engine.

#### Scenario: Launch
- **WHEN** the user launches the desktop app and nothing listens on the configured port
- **THEN** the server starts in-process and `http://localhost:<port>/` serves the web UI

#### Scenario: Quit
- **WHEN** the user chooses Quit from the tray menu
- **THEN** the engine persists its state, the port is released, and the process exits

### Requirement: Attach to existing server
Before starting its own server, the app SHALL call `GET /api/v1/health` on the configured address. If a TorrentX server answers, the app SHALL NOT start its own server and SHALL show that server's UI instead. If the port is occupied by something that is not TorrentX, the app SHALL show an error dialog naming the port and offering to open settings file location, instead of crashing.

#### Scenario: System service already running
- **WHEN** `torrentx-server` is already running on the configured port and the app launches
- **THEN** the app's window shows that server's UI and no second engine is started

#### Scenario: Foreign process on port
- **WHEN** a non-TorrentX process listens on the configured port
- **THEN** the app shows an error dialog mentioning the port

### Requirement: Tray icon and window
The app SHALL show a tray/menu-bar icon. Left-clicking the icon SHALL toggle the main window (show+focus if hidden, hide if visible). The tray menu SHALL offer: Show TorrentX, Open in Browser (opens `http://localhost:<port>/` in the default browser), and Quit. Closing the main window SHALL hide it to the tray rather than quit.

#### Scenario: Toggle window
- **WHEN** the window is hidden and the user clicks the tray icon
- **THEN** the window appears focused showing the web UI

#### Scenario: Close hides
- **WHEN** the user closes the main window
- **THEN** the window hides, the tray icon remains, and torrents keep downloading

#### Scenario: Open in browser
- **WHEN** the user picks Open in Browser
- **THEN** the default browser opens the server's UI URL

### Requirement: Window shows the server's web UI
The main window SHALL load the web UI from the server's HTTP URL (not a separately bundled copy), so the desktop window and a browser tab show the same UI and state. When auth is enabled and the server is in-process, the app SHALL log the window in automatically without prompting for the password.

#### Scenario: Same state as browser
- **WHEN** a torrent is added from a browser tab at `localhost:<port>`
- **THEN** it appears in the desktop window's list on the next refresh

#### Scenario: Auth enabled, in-process
- **WHEN** auth is enabled and the app starts its own in-process server
- **THEN** the window shows the torrent list without a login screen

### Requirement: Single instance
Launching the app while it is already running SHALL focus the existing window instead of starting a second instance.

#### Scenario: Second launch
- **WHEN** the user launches the app a second time
- **THEN** the existing instance's window is shown and no new process remains running

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
