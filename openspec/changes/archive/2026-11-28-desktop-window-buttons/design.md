## Context

- `Shell` renders `WindowDots` once, absolutely positioned at the window's top-left (`left 14px, top 21px`), so it
  never moves when the sidebar collapses. The sidebar head, or the top bar while the sidebar is collapsed, reserves
  its 47 px with `WindowDotsSpace`. Both render only when `isTauri()`.
- `lib/window.ts` holds the lazy Tauri calls (`closeWindow` hides, `minimizeWindow`, `toggleMaximizeWindow`) and
  `initDesktopChrome()`, which already sets `html[data-maximized]` from `isMaximized() || isFullscreen()` on every
  resize.
- `IS_MAC` (`lib/keymap.ts`) already switches key labels to `Ctrl+T` on other OSes, so the design's label changes
  need no work.
- `apps/web/src/index.css` rounds `#root` by 10 px under `html[data-desktop]`. The Windows webview is not
  transparent, so Windows 11 rounds the window itself.
- `capabilities/window.json` already grants hide, minimize, toggle-maximize, is-maximized, is-fullscreen, drag and
  event listen. Nothing new is needed.
- Design measurements: Windows group 3 × 46×32 at the top bar's right edge (`top 0`), top bar right padding 150 px.
  Linux group 3 × 24 px circles, gap 8, `top 15` in the 54 px bar, 14 px from the right, top bar right padding
  114 px. Icons are lucide `minus`, `square`, `x` (13 px on Windows, 12 px on Linux) in the text color. The Linux
  button fill is the raised surface color.

## Goals / Non-Goals

**Goals:**
- One place decides the window style (`mac | windows | linux`), and it is unit-tested.
- The buttons are pinned to the window corner like the dots today, so no view can push them around.

**Non-Goals:**
- Reading the user's GNOME/KDE button layout (left-side buttons, a missing minimize). The Linux design is fixed.
- Windows 11 snap layouts on maximize hover. That needs native `WM_NCHITTEST` handling and a new IPC surface.
- Changing the macOS dots or the macOS corner radius.
- A light-theme-specific look: the buttons use theme tokens, so light mode follows them.

## Decisions

1. **Platform from the user agent, in `lib/window.ts`.** Add a pure `windowStyle(ua: string): "mac" | "windows" |
   "linux"`: `Mac` → mac, `Windows` → windows, anything else → linux. Export `WINDOW_STYLE` computed once from
   `navigator.userAgent`. Alternative: the Tauri `os` plugin. Rejected because it adds a plugin and an IPC
   permission to learn what the user agent already says. The webviews (WKWebView, WebView2, WebKitGTK) all report
   the OS.

2. **One `WindowControls` component (`components/WindowControls.tsx`) replaces `WindowDots`.** It is rendered by `Shell` at the same spot in the
   tree, and it branches on `WINDOW_STYLE`. Mac keeps the current markup and position. Windows and Linux render an
   absolutely positioned group at `right: 0, top: 0` (Windows) or `right: 14px`, vertically centered in the 54 px
   bar (Linux). `WindowDotsSpace` becomes `WindowControlsSpace({ side })`: it renders on the left only for mac,
   and on the right only for windows and linux. TopBar puts the right spacer as its last child, sized 138 px
   (Windows) or 88 px (Linux). The bar's `gap` supplies the remaining space, so content can never sit under the
   buttons. Alternative: put the buttons inside TopBar. Rejected because TopBar is mounted per view (list, detail,
   settings), and a pinned element in `Shell` has one owner and does not move.

3. **Maximized state from `html[data-maximized]`.** The restore icon reads the attribute that `initDesktopChrome`
   already maintains. A tiny `useMaximized()` hook watches it with a `MutationObserver` on `documentElement`.
   Alternative: a second `onResized` listener. Rejected because it duplicates the IPC subscription.

4. **Colors from tokens only.** The Windows hover is `bg-ui-surface-2`; the close hover is `bg-ui-red`, and the icon
   keeps `text-ui-text`. The Linux fill is `bg-ui-surface-3`, and hover is `bg-ui-border-strong`. Icons use
   `text-ui-text`. `check-colors.mjs` forbids hex. The macOS dots keep their OS hex colors under the existing
   exemption.

5. **Corner radius per platform via `html[data-window]`.** `initDesktopChrome` also sets `data-window` to the
   style. The CSS rounds `#root` 10 px for mac and 12 px for linux, and adds no rounding for windows (the OS
   rounds it).

6. **i18n:** add `window.restore` ("Restore window") to all six locales. The existing close, minimize and maximize
   keys are reused.

## Risks / Trade-offs

- [The user agent can be spoofed or unusual, for example a BSD running Linux builds] → Unknown platforms fall back
  to the Linux style, which works everywhere.
- [Absolute buttons overlap the top bar when its right spacer is missing in some view] → The spacer is part of
  `TopBar` itself, not of each view's `trailing`. A manual check covers list, detail and settings.
- [On Windows, `data-tauri-drag-region="deep"` on the header could start a drag from the buttons] → The buttons
  are real `<button>`s, which Tauri leaves alone, and they live in `Shell` outside the header anyway.
