## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`):
  `active-tab-terminal-expanded.html` (07); `components.html` (board D, output row kinds);
  `active-tab-terminal-expanded-light.html` (16, light); `keymap.html` (board F). Read it for layout, spacing
  and copy; each element carries its canvas name in `data-pencil-name`. Colors there are resolved hex values:
  map them back to theme tokens, never copy the hex. Boards C, G, H have no export; use `pen/untitled.pen` for
  those.
- `Terminal.tsx` (74 lines) + `lib/terminal.ts`: `run(input, deps)` splits on whitespace and switches on
  `help | list | status | add | pause | resume | remove | clear | exit`; it has `node --test` coverage. The
  panel is hidden while details are open.
- `@torrentx/query` gives `parse`, `evaluate`, `compare`, `format`, `chips`, `complete` and `ParseError
  {message, column, length, suggestion}`.
- The server logs through `tracing` to stderr only; `policy.rs` emits `ServerEvent`s (added / completed) that
  the UI never sees as text. There is no log endpoint.
- The shell change provides the top bar toggle slot, the status bar handle slot, the command registry and the
  keymap.
- Source frames: 07, 16; board C; board D "Terminal output row"; board F "Terminal"; board G flow 4.

## Goals / Non-Goals

**Goals:** a drawer that overlays instead of displacing; commands whose targets and filters are queries; parser
errors and completion identical to the GUI; safe destructive commands; a logs pane.

**Non-Goals:** a remote shell or any command execution on the host (the `shell` tab is a permanently disabled
placeholder explaining that); a standalone `torrentx` CLI binary; piping or scripting between commands; log
persistence to disk or log shipping; per-window state in a multi-window sense (there is one window).

## Decisions

1. **Overlay, not layout.** The drawer is absolutely positioned over the main area (never the sidebar), default
   height 416 px, min 160, max = main height; "maximize" covers the main area below the top bar. The list
   underneath keeps its size, scroll and order. State `{open, height, maximized, tabs, activeTab, split}` is
   stored in `localStorage` under one key.
2. **Command line = command word + flags + one query.** `lib/terminal.ts` tokenizes respecting quotes, pulls
   out `--flags`, and hands the rest to `@torrentx/query` verbatim, so column numbers in `ParseError` are
   offset by the command prefix and the caret lines up under the user's own text. Commands:
   `ls [query] [--json] [--limit n]`, `status`, `add <magnet|url> [--paused]`, `pause|resume <target>`,
   `rm <target> [--force]`, `tag <target> +name -name…`, `open <target>`, `logs [query] [--follow]`,
   `help [fields|<command>]`, `clear`, `exit`; `list`/`remove` are aliases. `<target>` is an id prefix (hex,
   ≥ 4 chars, must be unique) or a query.
3. **Structured output rows.** `run()` returns `OutputRow[]` — `{kind: "table", columns, rows[{cells, ref?}]} |
   {kind: "json", value} | {kind: "error", message, caretCol, caretLen, suggestion} | {kind: "note"} |
   {kind: "confirm", …}` — instead of strings, so the view can make refs clickable, align columns in mono and
   render the caret, while tests assert on data. `ls` always ends with `n of total`.
4. **Confirmation is part of the command result.** A command is *dangerous* when it deletes data (`rm --force`)
   or when a query target resolves to more than one torrent for `rm`/`pause`/`resume`/`tag`. It returns a
   `confirm` row stating exactly what will happen ("deletes data on disk for 1 torrent"); nothing is sent until
   the user presses the confirm chord or, for data deletion, types the torrent name (or the count for several).
   Escape or any other input cancels. Enter alone never confirms.
5. **Completion.** The prompt calls `complete(input, caret)` on the query part and its own table for command
   words and flags; the best candidate is shown as ghost text (Tab accepts), the rest in the FIELDS popover.
   History (last 500 lines) persists in `localStorage`; `↑/↓` walk it, reverse search filters it.
6. **Streaming and the pager.** Only `logs --follow` streams; the interrupt chord stops it. It keeps running
   while the drawer is closed, and the status bar handle shows a spinner with the number of live commands.
   Scrollback is capped at 1,000 lines per tab; a single result longer than that opens in a pager view
   (space/arrow to page, `q` to leave) rather than being appended.
7. **Logs come from a ring buffer behind the API.** `logs.rs`: a `tracing` `Layer` pushes `{seq, time, level,
   target, message}` into a `Mutex<VecDeque>` capped at 2,000 entries; policy decisions and engine errors are
   logged through `tracing` so they show up. `GET /api/v1/logs?after=<seq>&limit=<n>` returns entries with
   `seq > after` and the latest `seq`. The logs tab polls with `usePoll` and filters client-side with the mini
   filter bar (`level:`, free text, `sort:` fixed to time). *Alt:* SSE/WebSocket — rejected, the UI is
   poll-based everywhere and the guard/auth story for a second transport is not worth it for a log tail.
8. **Save as tab** from the prompt saves the query part of the current input through the same inline confirm as
   everywhere else, but does not activate the new tab (board G: the terminal does not steal focus).
9. **Focus rules.** Escape in the drawer returns focus to the list and leaves the drawer open; the toggle
   shortcut closes it. Opening focuses the prompt.

## Risks / Trade-offs

- **Logs can reveal paths and tracker URLs.** → The endpoint sits behind the same auth and guards as every
  other route; passwords and passkeys are already redacted at the logging call sites, and a test asserts the
  announce-URL redaction.
- **Query targets make bulk mistakes easy.** → Mandatory confirmation for multi-torrent targets, with the count
  and the first names shown before anything is sent.
- **A disabled `shell` tab advertises a feature that does not exist.** → Its text says TorrentX never executes
  host commands; it is kept only because the design uses it to make the policy visible. Cheap to remove.
- **Ring buffer memory.** → 2,000 entries with messages truncated at 2 KB bounds it at a few MB.

## Migration Plan

1. Server log ring + endpoint (additive).
2. New `lib/terminal.ts` with tests, old command names kept as aliases.
3. Drawer replaces the panel; remove `Terminal.tsx`. Rollback = revert; no stored data.

## Open Questions

- Should `ls` default to the active tab's scope or to all torrents? Assumed **all torrents** — the terminal is
  a global surface like Spotlight, and the echoed `n of total` makes the scope explicit.
