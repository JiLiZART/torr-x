## ADDED Requirements

### Requirement: Rounded window corners
The frameless main window SHALL have rounded corners on macOS, Linux (with a compositing window manager) and Windows 11, with nothing of the page painted outside the rounded shape. While the window is maximized or fullscreen its corners SHALL be square. On systems that cannot render transparent or rounded windows (Windows 10, Linux without a compositor) the window SHALL fall back to square corners and otherwise work unchanged.

#### Scenario: Normal window
- **WHEN** the desktop window is shown at a normal (not maximized) size on macOS
- **THEN** all four window corners are rounded and the desktop behind shows through outside the curve

#### Scenario: Maximized window
- **WHEN** the user maximizes the window with the green dot
- **THEN** the corners become square so no gaps appear at the screen edges, and turn rounded again after restoring
