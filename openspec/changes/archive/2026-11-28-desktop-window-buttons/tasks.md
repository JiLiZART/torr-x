## 1. Platform detection

- [x] 1.1 Add `windowStyle(ua)` and `WINDOW_STYLE` to `packages/ui/src/lib/window.ts`, and make `initDesktopChrome`
      set `html[data-window]`. Verify with a new `window.test.ts` (macOS, Windows 10/11 and Linux/WebKitGTK user
      agent strings, unknown → linux) passing under `pnpm test`.
- [x] 1.2 Add a `useMaximized()` hook that reads `html[data-maximized]` through a `MutationObserver`. Verify with
      `pnpm typecheck`.

## 2. Window buttons

- [x] 2.1 Replace `WindowDots` with `WindowControls` in `Sidebar.tsx`/`Shell.tsx`: the mac dots stay as they are;
      add the Windows caption group (3 × 46×32, top-right corner, red close hover) and the Linux round group
      (3 × 24 px, gap 8, 14 px from the right, centered in the 54 px bar), using lucide `Minus`, `Square`/`Copy`
      (restore) and `X` with token colors only. Verify that `pnpm lint` passes, including `check-colors`.
- [x] 2.2 Replace `WindowDotsSpace` with `WindowControlsSpace({ side })`: left spacer for mac in the sidebar head
      or the collapsed top bar, right spacer (138 or 88 px) as the last child of `TopBar` for windows and linux.
      Verify with `pnpm typecheck`, and check that no top bar control renders under the buttons at 900 px width.
- [x] 2.3 Add `window.restore` to `en`, `fr`, `de`, `es`, `ru` and `zh`, and use it as the maximize button label
      while maximized. Verify that `pnpm lint` passes the i18n key check.

## 3. Corners

- [x] 3.1 In `apps/web/src/index.css`, round `#root` 10 px for `data-window="mac"`, 12 px for `"linux"`, and not at
      all for `"windows"`, square while `data-maximized`. Verify with `pnpm build:web`.

## 4. Verification

- [x] 4.1 Fake each platform in `pnpm dev:web` by overriding `navigator.userAgent` and setting
      `__TAURI_INTERNALS__`. Compare the top bar against `pen/nodes/active-tab-windows.html` and
      `pen/nodes/active-tab-linux.html` in the list, detail and settings views, with the sidebar collapsed and
      expanded, in dark and light. Confirm that a plain browser shows no buttons.
- [x] 4.2 Run `pnpm lint`, `pnpm typecheck` and `pnpm test`, all green. Add a `.changeset/` file (`default: minor`,
      "Native-style window buttons on Windows and Linux").
