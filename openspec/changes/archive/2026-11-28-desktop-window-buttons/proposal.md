## Why

The frameless desktop window shows macOS traffic-light dots on every OS. On Windows and Linux they look foreign
and sit on the wrong side, so users there do not find the close, minimize and maximize buttons where they expect
them. The designs `pen/nodes/active-tab-windows.html` and `pen/nodes/active-tab-linux.html` define the native-looking
buttons for both platforms.

## What Changes

- On Windows, the desktop window shows Windows-style caption buttons (minimize, maximize/restore, close): three
  46×32 px buttons flush in the window's top-right corner, with thin line icons.
- On Linux, the desktop window shows GNOME-style buttons: three round 24 px buttons with a filled background,
  8 px apart, centered vertically in the top bar, 14 px from the right edge.
- On both, the buttons sit at the right end of the top bar and no dots appear in the sidebar head. The top bar
  keeps its content clear of the buttons. The buttons stay in place when the sidebar collapses, and on the detail
  page and in settings.
- The maximize button shows a restore icon while the window is maximized (Windows convention; applied to Linux too).
- Close still hides the window to the tray, as the red dot does.
- macOS keeps the red, yellow and green dots exactly as today.
- On Linux the rounded window corners become 12 px (design); Windows keeps its native rounding, and macOS keeps
  10 px.
- A plain browser still shows no window buttons on any OS.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-ui`: "Window controls" changes from always-dots to platform-specific buttons (dots on macOS, caption
  buttons on the right on Windows and Linux).
- `desktop-app`: "Frameless window" names the window buttons per platform instead of only the red dot.

## Impact

- `packages/ui/src/components/Sidebar.tsx` (`WindowDots`, `WindowDotsSpace`), `Shell.tsx`, `TopBar.tsx`: render
  per-platform controls and reserve their space on the matching side.
- `packages/ui/src/lib/window.ts`: platform detection for the window style, and the maximized state the restore
  icon needs.
- `packages/ui/src/i18n/*.json`: a "Restore window" label.
- `apps/web/src/index.css`: corner radius per platform.
- No server, API, or Tauri capability changes: the same window operations (hide, minimize, toggle maximize,
  is-maximized, resize events) are used.
