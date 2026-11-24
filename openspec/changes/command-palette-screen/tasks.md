## 1. Registry and keymap

- [ ] 1.1 `lib/commands.ts`: registry `{id, label, icon, scope, keys, enabled, run}`; register every existing
      GUI action (pause/resume selected/tab/all, remove, verify, reveal, save as tab, open settings, toggle
      terminal, …); verify a unit test enumerates all rendered action buttons and finds each in the registry
- [ ] 1.2 `lib/keymap.ts`: global hotkeys from the registry, input-field guards, `⌘K` shortcut sheet; verify
      `Space` pauses the selected torrent only when the list has focus and a selection exists
- [ ] 1.3 Full keyboard map: ⌘1…9 tab jump, next/prev tab, new tab, save lens, rename, collapse sidebar, focus
      filter, open builder, clear lens, undo chip, row cursor/extend/select-all, open torrent, pause/resume,
      remove, tag, back/forward, settings; platform modifier rendering (Ctrl/Alt on Win/Linux); verify
      keyboard-only operation of each and the typing guard
- [ ] 1.4 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 2. Palette surface

- [ ] 2.1 `Palette` panel: ⌘T opens centered over a dimmed/blurred scrim, `>` input prefix, header hint,
      footer key hints, esc dismiss with focus restore; verify against screen 08 in dark and light
- [ ] 2.2 Jump mode (plain text): ranked tabs + torrents with context lines, pinned All torrents always
      present; verify typing `arch` ranks the archlinux torrent and `⏎` opens it
- [ ] 2.3 Query mode (parseable query): sections ACTIONS / FILTER / JUMP TO / CREATE TAB in fixed order,
      never mixed; verify `paus` stays jump mode while `state:paused` switches to grouped
- [ ] 2.4 ACTIONS rows: icon, label, scope label, keybinding; selection commands disabled without selection;
      verify `⌘⇧P` from the palette pauses exactly the active tab's torrents
- [ ] 2.5 FILTER rows: active-tab lens result with live match count (`⇥`), All-torrents variant (`⇧⏎`
      switches tab then applies); verify neither creates a sidebar entry and the chips appear in the bar
- [ ] 2.6 CREATE TAB row: highlighted, `⌘S`, creates without activating; verify it is the only palette result
      that writes the sidebar
- [ ] 2.7 Navigation: `↑↓` wrap within section, `⇥` cycles sections, `⏎` runs; verify keyboard-only operation
      of every result kind

## 3. Integration and verification

- [ ] 3.1 Plain text never auto-filters: verify typing `ubuntu` in the palette leaves the list untouched
      until a result is chosen
- [ ] 3.2 i18n keys in all six dictionaries; verify `pnpm lint` parity
- [ ] 3.3 Manual check against screens 02, 03 and 08: layout, section order, scope labels, key hints; verify
      `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
