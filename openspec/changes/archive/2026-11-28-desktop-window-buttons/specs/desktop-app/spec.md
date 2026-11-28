## MODIFIED Requirements

### Requirement: Frameless window
The main window SHALL be created without native decorations (no OS title bar or native window buttons) on macOS,
Windows and Linux, keeping the OS shadow where available, resizable, with a minimum size of 900×600. Window
controls are provided by the web UI: red, yellow and green dots on macOS, and minimize, maximize and close
buttons at the right of the top bar on Windows and Linux. Closing with the red dot or the close button SHALL hide
the window to the tray exactly like the former native close. The window corners SHALL be rounded: on macOS and
Linux by the page itself (12 px on Linux), on Windows by the OS. The corners SHALL be square while the window is
maximized or fullscreen. The window SHALL grant the loaded server origin only the window permissions needed for
close/hide, minimize, toggle maximize, reading the maximized and fullscreen state, resize events and dragging.

#### Scenario: No native title bar
- **WHEN** the desktop app shows its window
- **THEN** there is no native title bar and the web UI's window buttons are the only window buttons

#### Scenario: Red dot hides
- **WHEN** the user clicks the red dot on macOS
- **THEN** the window hides and the app keeps running in the tray

#### Scenario: Close button hides
- **WHEN** the user clicks the close button on Windows or Linux
- **THEN** the window hides and the app keeps running in the tray

#### Scenario: Square corners when maximized
- **WHEN** the window is maximized on Linux
- **THEN** its corners are square, and they round again to 12 px when it is restored

#### Scenario: No other IPC
- **WHEN** page script in the window invokes any Tauri command other than those window operations
- **THEN** the call is denied
