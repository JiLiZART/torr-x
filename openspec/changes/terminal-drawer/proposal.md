## Why

The terminal today is a small panel with nine hard-coded commands and its own argument handling: `list` cannot
filter, errors are plain strings, nothing completes, and it disappears whenever details are open. The design
(`pen/untitled.pen`, screens 07 and 16, board C "Terminal drawer", board G flow 4, board H "One parser") places
it where a browser puts devtools and makes it a first-class surface of the same query language — a query typed
in the terminal is the query in the filter bar, with the same errors and the same completions.

## What Changes

- **DevTools-style drawer**: toggled from the top bar and by shortcut, slides up over the lower part of the main
  area without resizing or re-sorting the list, on every view (list, torrent page, settings). Resizable,
  maximizable, with a collapsed handle in the status bar. Height, tabs and split are remembered.
- **Drawer tabs**: `client` (the command line; more can be opened), `logs`, and `shell`, which is shown disabled
  with a policy explanation — TorrentX does not run a remote shell.
- **Commands speak the query language**: `ls <query> [--json] [--limit n]`, and `pause`, `resume`, `rm`, `tag`
  accept either an id prefix or a query as their target. Human output is an aligned table; `--json` prints the
  API objects. `help` and `help fields` come from the shared field registry.
- **Same errors, same completion**: a bad query prints the parser's message with a caret under the failing
  column and a suggestion; inline ghost completion and a fields popover use the same source as the filter
  builder and Spotlight; history with reverse search.
- **Clickable output**: torrent ids and names open that torrent's page, leaving the drawer open.
- **Dangerous commands never run on Enter alone**: deleting data, or acting on more than one torrent through a
  query, needs an explicit confirm chord or the typed name.
- **Save as tab from the prompt**: the typed query can be saved as a tab without stealing focus.
- **Logs pane**: recent server log lines with their own filter bar (`level:warn`), optionally split beside the
  client. Backed by a new log endpoint.
- **BREAKING (terminal)**: `list` and `remove` remain as aliases of `ls` and `rm`; output format of `list`
  changes to the table.

## Capabilities

### New Capabilities
- `server-logs`: an in-memory ring of recent server log entries exposed over the API.

### Modified Capabilities
- `web-ui`: "Terminal panel" becomes the terminal drawer with query-aware commands, completion, confirmation,
  logs and the disabled shell tab.

## Impact

- `packages/ui`: `Terminal.tsx` replaced by `terminal/` (`Drawer`, `ClientTab`, `LogsTab`, `Prompt`,
  `OutputRow`, `Pager`); `lib/terminal.ts` rewritten on top of `@torrentx/query` (command table, argument
  parser, table formatter) with its tests; drawer state in `localStorage`; commands registered in the shell's
  command registry; i18n keys in six dictionaries.
- `packages/query`: `--flag` tokens are not part of the grammar — the terminal splits flags off before parsing.
- `crates/torrentx-server`: `logs.rs` (bounded ring fed by a `tracing` layer, also receiving policy events),
  `GET /api/v1/logs`; `main.rs` and the desktop crate install the layer.
- `packages/api-client`: `logs()` and `LogEntry`.
- Depends on `browser-shell-and-spotlight` (top bar toggle, status bar handle, command registry) and
  `query-language-and-smart-tabs`; clickable references open the page from `torrent-detail-page` when present.
- No standalone CLI binary and no remote shell (non-goals).
