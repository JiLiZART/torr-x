## Why

Screens 17 and 18 (`pen/untitled.pen`, `X2irCa`, `CnhUq`) are the fresh-install experience: a library with
nothing in it must say so explicitly and teach the three-layer model in one glance, and a first run must ask
the three questions that matter (engine, library folder + starting tabs, who can reach the UI) without
downloading anything. Today a fresh install drops the user into an empty table with defaults they never saw.

This change implements both screens from the ground up. It **replaces** the first-run portion of the removed
board-derived `setup-settings-page-and-login` change and takes over the "Empty library state" requirement
from `add-flow-and-theming` (which keeps the add flow and theming only).

## What Changes

- **Empty library state (screen 17)**: when the library total is 0, the list area shows an inbox mark,
  "No torrents yet", the sentence "The library is empty — this is not a filter. Add a magnet link or a
  .torrent file and it lands in the All tab.", a drop zone ("Drop a .torrent file here, or paste a magnet
  link"), three actions with shortcuts (Paste magnet ⌘V, Add .torrent ⌘O, Open Spotlight ⌘T) and three
  orientation cards: *Tabs are saved queries*, *Chips are the lens*, *Terminal speaks the same language*
  (⌃` · `ls state:active tag:4k sort:ratio`). The top bar caption reads "no lens · nothing to filter yet",
  the filter input placeholder is "Filter by name…", and the status bar reads `0 torrents · engine <name> ·
  idle`. Distinct from zero-results; never offers "clear lens".
- **First-run setup (screen 18)**: a three-step wizard — 1 Engine, 2 Library, 3 Access — with a checked
  step rail, version badge, Back / Continue ⏎ and a one-click **Skip — use defaults**. Step 2 as drawn:
  Download folder (must be writable, live free space, Browse…), Move completed downloads (optional ·
  "handled by torrentx when the engine can't"), and "Start with these tabs" — a checkbox list of saved
  queries with pin badges (All `state:*` pinned, Downloading `state:downloading` pinned, Seeding,
  Stalled, 4K Movies `tag:4k category:movies`, Recently added `added:<7d sort:added desc`), editable later.
  Step 3 asks loopback-only vs network exposure; default loopback, no password. Footer promise: nothing is
  downloaded during setup. Existing installs never see the wizard.
- **Server**: `health.setupRequired`, one-shot `POST /setup` (validate-all-then-apply, tabs exactly as given,
  non-loopback bind without auth rejected, 409 after completion), and `POST /fs/check`
  (`{exists, isDir, writable, freeBytes}`, never creates or lists anything) backing the "must be writable"
  row and Browse….

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: adds "Empty library state" and "First-run setup".
- `http-api`: adds "Setup endpoints" and "Path check endpoint".

## Impact

- `packages/ui`: `EmptyLibrary` (moved from `add-flow-and-theming`), `setup/SetupWizard` + three steps +
  `TabPicker`; `App.tsx` gates on `setupRequired`; i18n keys in six dictionaries.
- `packages/api-client`: `setup()`, `setupState`, `checkPath()`.
- `crates/torrentx-server`: `config.rs` `setup_completed`, `api.rs` `/setup` + `/fs/check`, health field.
- Depends on `active-tab-screen` (shell, tabs-as-queries) and `add-flow-and-theming` (the add actions the
  empty state links to). Settings (`settings-page-screen`) owns everything the wizard skips.
