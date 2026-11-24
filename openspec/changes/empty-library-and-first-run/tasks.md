## 1. Server: setup state and path check

- [ ] 1.1 `config.rs`: `setup_completed` flag; `health` gains `setupRequired` (true only for never-confirmed
      default configs, false for pre-existing ones); verify config + health tests
- [ ] 1.2 `api.rs`: `POST /setup` validate-all-then-apply (engine, downloadDir, moveCompleted, tabs, access),
      tabs exactly as given, non-loopback without auth → 400, empty body completes with defaults, 409 after
      completion; verify tower `oneshot` tests for each path incl. atomic rejection
- [ ] 1.3 `api.rs`: `POST /fs/check` `{exists, isDir, writable, freeBytes}` via nearest existing ancestor,
      creates/lists nothing, guards apply; verify tests for missing-but-writable parent and read-only dir
- [ ] 1.4 Verify `cargo test --workspace` passes

## 2. Empty library state

- [ ] 2.1 `EmptyLibrary` per screen 17: inbox mark, headline, not-a-filter sentence, drop zone, three actions
      with shortcuts (⌘V / ⌘O / ⌘T), three orientation cards; top bar caption "no lens · nothing to filter
      yet", placeholder "Filter by name…", status bar `0 torrents · engine <name> · idle`; verify on a fresh
      server and that the first add replaces it with the list
- [ ] 2.2 Distinct from zero-results: verify both conditions never render together and empty state offers no
      "clear lens"
- [ ] 2.3 Drop zone accepts `.torrent` drops into the add flow; verify a drop opens the palette add mode

## 3. First-run wizard

- [ ] 3.1 `SetupWizard` gate on `setupRequired`: step rail with checks, version badge, Back / Continue ⏎,
      Skip — use defaults posting `{}`; verify existing installs never see it
- [ ] 3.2 Step 1 Engine: choose rqbit/Transmission with connection fields and live test; verify selection
      persists into setup payload
- [ ] 3.3 Step 2 Library per screen 18: download folder with debounced `/fs/check` writable + free space +
      Browse…, move-completed toggle with the "handled by torrentx when the engine can't" note, tab picker
      (name, pin badge, mono query text, checkboxes); verify unwritable path blocks Continue with the red row
- [ ] 3.4 Step 3 Access: loopback default; network exposure requires a password inline; verify rejection
      message matches the server's atomic validation
- [ ] 3.5 Footer promise visible on every step: nothing is downloaded during setup; verify no torrent exists
      after completing with defaults
- [ ] 3.6 i18n keys in all six dictionaries; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; manual
      check of screens 17 and 18 in dark and light against the canvas
