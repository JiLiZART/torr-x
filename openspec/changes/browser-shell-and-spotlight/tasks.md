## 1. Tokens and appearance preference

- [ ] 1.1 `crates/torrentx-server/src/config.rs`: replace `Theme` + `use_system_theme` with
      `Appearance {mode, accent}`, convert the old keys on load (never write them); verify a unit test loading a
      config with `theme = "dark-blue"` yields `dark` + `cyan` and `cargo test -p torrentx-server` passes
- [ ] 1.2 `packages/api-client`: `Preferences.appearance`, drop `theme`/`useSystemTheme`; verify `pnpm typecheck`
- [ ] 1.3 `packages/ui/src/theme.css` + Tailwind preset: the `--tx-*` ramp with dark and light values from the
      canvas `ui-*` variables, accent overrides, radii 8/12/16/22; `lib/theme.ts` applies `data-mode` /
      `data-accent` and follows `prefers-color-scheme` live for `system`; verify by toggling the OS appearance
- [ ] 1.4 Bundle Inter and JetBrains Mono (`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`)
      and map them to the sans/mono font tokens; verify the network panel shows no cross-origin font request
- [ ] 1.5 Sweep existing components for literal colors and theme-specific classes; verify `pnpm lint` passes
      and list, details and settings are legible in both modes

## 2. Shell and navigation

- [ ] 2.1 `lib/route.ts`: hash routes for `tab`, `torrent`, `settings` with push/replace and a `useRoute` hook;
      verify `node --test` cases for parse/format round-trips and unknown hashes
- [ ] 2.2 `Shell`, `Sidebar` (dots, Spotlight trigger, tab list from the previous change, new tab / save lens,
      transfer totals with ratio/CPU/memory popover) and `TopBar` (back, forward, title, lens summary, terminal
      toggle, settings); delete `Header.tsx`; verify against frames 01 and 14 in both modes
- [ ] 2.3 Window dragging and dots in the new chrome via `lib/window.ts`, including the collapsed-sidebar
      position; verify in `pnpm dev:desktop` (drag, minimize, maximize, hide) and that a browser shows no dots
- [ ] 2.4 Sidebar collapse (persisted in `localStorage`) and the stale-address fallback to "All" with a notice;
      verify by reloading collapsed and by opening a hash for a deleted tab
- [ ] 2.5 `StatusBar`: match counts, engine name/state, free space, terminal toggle; verify against a running
      server with a lens applied

## 3. Commands and keyboard

- [ ] 3.1 `lib/commands.ts` registry (`id, title, scope, keys, run, enabled`) covering every existing button
      and menu action; verify a `node --test` case asserting unique ids and no duplicate bindings per scope
- [ ] 3.2 `lib/keymap.ts`: global handler with platform modifiers, text-field guard and browser fallbacks;
      verify tests for chord matching and that unmodified keys are ignored inside inputs
- [ ] 3.3 `ShortcutSheet` generated from the registry, grouped as on board F; verify the sheet shows Ctrl/Alt on
      a non-mac user agent
- [ ] 3.4 List keyboard navigation: row cursor, range selection, select all shown, Enter, Space, remove with
      confirmation, add tag; verify each manually against a running server

## 4. Spotlight

- [ ] 4.1 `spotlight/classify.ts` (`add | command | query | jump`) and `spotlight/rank.ts` (name ranking over
      torrents and tabs); verify `node --test` cases for magnets, `.torrent` URLs, `>` commands, structured
      queries, plain words and a plain word containing `:`
- [ ] 4.2 `Spotlight` panel: scrim, input, sections per mode, parse strip with chips and `n of total`, parse
      error with column marker, footer hints, arrow/Enter/Escape handling; verify against frames 02, 03, 08, 13
- [ ] 4.3 Wire rows: open torrent/tab, "filter instead", lens in active tab, "show all" in the All tab, save as
      tab (reusing the previous change's inline confirm), actions on matches; verify typing never changes the
      list behind the panel
- [ ] 4.4 Actions section from the command registry with scope labels and disabled reasons; verify `> pause`
      with and without a selection

## 5. Add flow inside Spotlight

- [ ] 5.1 Move preview, options and file tree from `AddTorrent.tsx` into `spotlight/AddFlow.tsx`; panel phases
      `idle | resolving | expanded | committing` with a pinned top edge and height-only animation; verify
      against frame 04 and board B
- [ ] 5.2 File list with the mini `FilterBar` (file-scoped fields), Select all / none / Invert, per-file
      priority and shown-of-total count; verify hidden files keep their checked state
- [ ] 5.3 Options: save path with free space, start immediately, create subfolder, priority, tags (sent via
      `PUT /torrents/{id}/tags` after add); unsupported options disabled with the capability hint; verify
      under both engines
- [ ] 5.4 Entry points: paste, "Add .torrent" picker, window-wide drop; duplicate and 30 s timeout states;
      add-and-start / add-paused / cancel shortcuts; verify each manually and that the active tab and lens are
      unchanged after adding
- [ ] 5.5 Delete the Add modal and its entry points; keep `Modal.tsx` for confirmations; verify `pnpm lint`
      and `pnpm typecheck`

## 6. Empty library and wrap-up

- [ ] 6.1 `EmptyLibrary` state with drop zone, three actions and orientation cards, shown only when the library
      total is 0; verify against frame 17 and that a lens-emptied tab still shows the zero-results state
- [ ] 6.2 i18n keys for all new strings in the six dictionaries; verify `pnpm lint`
- [ ] 6.3 Update `CLAUDE.md` and `openspec/config.yaml` (layout, look-and-feel convention, appearance
      preference) and add a `.changeset/` entry; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` and
      `cargo test --workspace` pass
