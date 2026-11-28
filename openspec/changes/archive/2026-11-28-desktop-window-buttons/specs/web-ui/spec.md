## MODIFIED Requirements

### Requirement: Window controls
Inside the desktop window, the UI SHALL show close (hide to tray), minimize and maximize buttons styled for the
OS it runs on:

- macOS: red, yellow and green dots at the top of the sidebar, in that order. While the sidebar is collapsed the
  dots SHALL move into the top bar.
- Windows: three caption buttons (minimize, maximize, close), each 46×32 px, flush in the window's top-right
  corner. A hovered button SHALL get a highlighted background, and a hovered close button SHALL turn red.
- Linux: three round 24 px buttons (minimize, maximize, close) with a filled background, 8 px apart, centered
  vertically in the top bar and 14 px from the window's right edge.

On Windows and Linux the buttons SHALL stay at the right end of the top bar in every view, including a collapsed
sidebar, the detail page and settings. No dots SHALL appear in the sidebar head. The top bar content SHALL NOT
run under the buttons. While the window is maximized, the maximize button SHALL show a restore icon and label.
Every button SHALL have an accessible label. The empty areas of the sidebar head and of the top bar SHALL drag
the window, and double-clicking them SHALL toggle maximize. Interactive elements, the window buttons included,
SHALL NOT start a drag. In a plain browser no window buttons SHALL be rendered on any OS.

#### Scenario: Drag window
- **WHEN** the user drags the empty area of the top bar
- **THEN** the window moves; clicking the Spotlight trigger does not move it

#### Scenario: No dots in a browser
- **WHEN** the UI is opened in a regular browser tab
- **THEN** no red, yellow or green window dots are shown

#### Scenario: No window buttons in a browser on Windows or Linux
- **WHEN** the UI is opened in a regular browser tab on Windows or Linux
- **THEN** no minimize, maximize or close buttons are shown

#### Scenario: Collapsed sidebar
- **WHEN** the user collapses the sidebar in the desktop window
- **THEN** the window buttons are still visible and working: in the top bar on macOS, and unchanged at the top
  bar's right end on Windows and Linux

#### Scenario: Windows caption buttons
- **WHEN** the desktop app runs on Windows
- **THEN** minimize, maximize and close buttons appear in the top-right corner, and no dots appear in the sidebar
  head

#### Scenario: Windows close hover
- **WHEN** the pointer rests on the close button on Windows
- **THEN** the button background turns red

#### Scenario: Linux buttons
- **WHEN** the desktop app runs on Linux
- **THEN** three round minimize, maximize and close buttons appear at the right end of the top bar, and no dots
  appear in the sidebar head

#### Scenario: Close hides to tray
- **WHEN** the user clicks the close button on Windows or Linux
- **THEN** the window hides and the app keeps running in the tray

#### Scenario: Restore icon while maximized
- **WHEN** the window is maximized on Windows or Linux
- **THEN** the maximize button shows a restore icon and its label reads "Restore window"; clicking it restores the
  window size and the icon returns to maximize

#### Scenario: Top bar content stays clear
- **WHEN** the window is narrow on Windows or Linux and the top bar holds many controls
- **THEN** no top bar control is drawn under or behind the window buttons

#### Scenario: Buttons do not drag
- **WHEN** the user presses a window button and moves the pointer
- **THEN** the window does not move
