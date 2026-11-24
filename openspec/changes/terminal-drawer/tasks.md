## 1. Server logs

- [ ] 1.1 `crates/torrentx-server/src/logs.rs`: bounded ring (2,000 entries, 2 KB message cap, monotonically
      increasing `seq`) and a `tracing` layer feeding it; install it in `main.rs` and in the desktop crate's
      in-process start; verify unit tests for overflow and ordering
- [ ] 1.2 Log policy decisions, engine errors and tracker failures through `tracing` with redacted announce
      URLs; verify a test asserting a passkey never reaches the buffer
- [ ] 1.3 `GET /api/v1/logs?after&limit` behind the existing guards; `packages/api-client` `logs()` +
      `LogEntry`; verify tower `oneshot` tests (tail, empty, limit, 401 with auth on) and `pnpm typecheck`

## 2. Command engine

- [ ] 2.1 Rewrite `packages/ui/src/lib/terminal.ts`: quote-aware tokenizer, flag extraction, command table with
      aliases (`list`, `remove`), target resolution (unique id prefix or query) on `@torrentx/query`; verify
      `node --test` cases per command and for ambiguous / unknown prefixes
- [ ] 2.2 Structured `OutputRow`s (`table | json | error | note | confirm`) and the table formatter; parser
      errors carry a caret column offset by the command prefix; verify `ls statu:active` yields the caret under
      `statu` and suggestion `state`
- [ ] 2.3 `ls` with `--json`, `--limit`, sort from the query and the `n of total` footer; `help`,
      `help fields` and `help <command>` generated from the registries; verify tests
- [ ] 2.4 Dangerous-command detection and the two-step confirm protocol (chord or typed name / count, anything
      else cancels); verify tests that `rm --force` and a multi-match `pause` send nothing before confirmation
- [ ] 2.5 Completion (command words, flags, `complete()` for the query part) and persistent history with
      reverse search; verify tests for completing `ls state:` and for history ordering

## 3. Drawer

- [ ] 3.1 `terminal/Drawer`: overlay over the main area, resize handle, maximize, tab strip (`client` ×n,
      `logs`, disabled `shell` with its explanation), split, persisted state; top bar toggle and status bar
      handle; verify against frames 07 and 16 and that the list's scroll and order are unchanged underneath
- [ ] 3.2 `ClientTab` + `Prompt`: ghost completion, fields popover, history keys, save-as-tab without
      activation, focus rules (Escape → list, toggle closes); verify each against board F "Terminal"
- [ ] 3.3 `OutputRow` rendering: mono table, JSON, error with caret and suggestion, confirm row, clickable
      torrent refs opening the torrent with the drawer left open; verify against board D "Terminal output row"
- [ ] 3.4 `LogsTab`: polling tail, mini filter bar (`level:`, text), empty state, split beside the client;
      verify `level:warn` and that a refused tracker shows up
- [ ] 3.5 `logs --follow` streaming with interrupt, background-running indicator on the status handle,
      scrollback cap and the pager for results over 1,000 lines; verify by closing the drawer mid-stream and by
      listing a large library

## 4. Wrap-up

- [ ] 4.1 Register terminal commands and shortcuts in the command registry / shortcut sheet; remove
      `Terminal.tsx` and the "hidden while details are open" rule; verify the drawer opens over the torrent page
- [ ] 4.2 i18n keys in all six dictionaries, `.changeset/` entry, `CLAUDE.md` (logs endpoint, terminal
      commands); verify `pnpm lint`, `pnpm typecheck`, `pnpm test` and `cargo test --workspace`
