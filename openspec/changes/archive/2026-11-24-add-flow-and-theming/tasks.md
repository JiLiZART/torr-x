## 1. Add flow in the palette

- [x] 1.1 Add mode detection (magnet/URL payload, chosen file, window drop) expanding the panel with pinned top
      edge; loading line at constant height; Escape returns to input-only; verify against board B's six frames
- [x] 1.2 Add flow content: metadata header, sections Files/Trackers/Options/Advanced, file list with checkboxes
      + per-file priority + Select all/none/invert + mini filter bar (file fields), save path with free space,
      options (start immediately, subfolder, priority, tags); verify checked state survives filtering
- [x] 1.3 Footer actions Add & start / Add paused / Cancel; duplicate-id offer to jump; 30 s metadata timeout
      with add-anyway; capability-disabled options with engine hint; verify lens and active tab untouched
- [x] 1.4 Remove `AddTorrent.tsx` modal and its entry points; verify no modal add path remains
- [x] 1.5 Verify `pnpm lint`, `pnpm typecheck` pass

## 2. Tokens and appearance

- [x] 2.1 `theme.css` + Tailwind preset: one neutral ramp + accent per mode (`$ui-*`); migrate every component
      off literal colors; add a lint guard; verify light frames 13–16 render legibly
- [x] 2.2 `config.rs` + api-client: `appearance {mode, accent}` replacing `theme`/`useSystemTheme`, validation,
      migration of all legacy combinations; verify config tests + `GET /settings` shape
- [x] 2.3 `system` mode live-switches with the OS; accent choice swaps the accent ramp; verify without reload
- [x] 2.4 Self-host Inter + JetBrains Mono (rust-embed), no external font requests; verify offline load
- [x] 2.5 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test`, `cargo test --workspace` pass; manual dark/light
      check of screen 04 against the canvas
