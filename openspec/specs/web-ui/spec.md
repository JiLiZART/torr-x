# web-ui Specification

## Purpose
Defines the browser-based TorrentX UI served by the server and shown in the desktop window: torrent management, settings, and login, driven solely through the HTTP API.

## Requirements

### Requirement: HTTP-only data access
The web UI SHALL obtain all data and perform all actions through the `/api/v1/*` HTTP API on its own origin, and SHALL NOT depend on Tauri IPC, so the identical build works in a browser and in the desktop window. The only permitted Tauri calls are window controls (close/hide, minimize, maximize, drag), made only when a Tauri runtime is detected; without it they are skipped and no Tauri code is loaded.

#### Scenario: Plain browser
- **WHEN** the UI is opened in a regular browser with no Tauri runtime
- **THEN** every feature works and the console shows no Tauri-related errors

### Requirement: Torrent list with live refresh
The UI SHALL show, for the active tab, every torrent matching the tab's query ANDed with the current lens,
ordered by the query's `sort:` predicate, in the columns NAME, SIZE, PROGRESS, DOWN, UP, PEERS, RATIO, STATE,
TAGS, TRACKER. Rows SHALL have one fixed height: a two-line name cell (name clamped with full-name tooltip;
secondary line = tracker · added age, replaced by the state reason while checking, paused or errored), size,
progress bar + percent (or `done`), down/up rates with arrows (or `—` when idle), peer count, ratio, the state
word in its state color, up to two tag chips, and the short tracker name. Numeric cells SHALL never wrap.
The list SHALL refresh at least every 2 seconds while visible with no layout shift. Column headers SHALL edit
the `sort:` chip; no other ordering control may exist. When nothing matches, a zero-results state SHALL name
the tab query, the lens and the responsible predicate, with Clear lens / remove predicate recovery. The
terminal look (green-on-black, monospace) SHALL be kept via theme tokens in both modes. When the API returns
`engine_unavailable`, the UI SHALL show a visible banner with the error and a link to settings instead of an
unexplained empty list.

#### Scenario: Live progress
- **WHEN** a torrent is downloading
- **THEN** its progress and rates update in place without a page reload and no row changes height or position

#### Scenario: State reason in the row
- **WHEN** a torrent is paused by the user
- **THEN** its secondary line reads "paused by user" instead of tracker · added age

#### Scenario: Sorting goes through the query
- **WHEN** the user clicks the SIZE header twice
- **THEN** the chip row shows `sort:size asc` and the list orders by size ascending

#### Scenario: Sort by size
- **WHEN** the user clicks the SIZE header twice
- **THEN** the chip row shows `sort:size asc`, the list is ordered by size ascending and the SIZE header marks the
  direction

#### Scenario: Search with no result
- **WHEN** the user types `zzz` in the name filter and no torrent in the tab matches
- **THEN** the zero-results state names `name:*zzz*` as the predicate that emptied the list and offers to remove
  it or clear the lens

#### Scenario: Engine unavailable
- **WHEN** the API returns `engine_unavailable`
- **THEN** the UI shows a visible banner with the error message and a link to settings, instead of an empty
  list with no explanation

### Requirement: Torrent actions
The UI SHALL let the user, from each row's inline buttons and its "more" menu: pause, resume, remove, remove and erase data (explicit in-page confirmation), show in file manager, move to tab (submenu of user tabs), move data to another directory, rename, save the `.torrent` file, copy the magnet link to the clipboard, and verify (force recheck). Clicking a row SHALL toggle the details panel for that torrent. An action the active engine does not support SHALL be shown disabled with a "not supported by <engine>" tooltip. Any failed action SHALL show the API error message.

#### Scenario: Add magnet
- **WHEN** the user pastes a magnet link and submits
- **THEN** the torrent appears in the list

#### Scenario: Remove with data
- **WHEN** the user chooses "Remove and erase data"
- **THEN** the UI asks for confirmation in-page and only then calls the API with `deleteData=true`

#### Scenario: Action error
- **WHEN** an action fails (e.g. `invalid_input` for a bad magnet)
- **THEN** the UI shows the API error message

#### Scenario: Copy magnet
- **WHEN** the user chooses "Copy magnet link"
- **THEN** the clipboard holds a `magnet:?xt=urn:btih:<id>` URI including the display name and trackers, and a confirmation is shown

#### Scenario: Save torrent file
- **WHEN** the user chooses "Save .torrent file" on a torrent whose metadata is known
- **THEN** the browser downloads `<name>.torrent` whose info-hash equals the torrent id

#### Scenario: Unsupported action
- **WHEN** the engine reports it cannot set per-file priority
- **THEN** the High/Low priority items are disabled with the engine name in the tooltip, and Skip/Normal remain usable if supported

### Requirement: Settings screen
The UI SHALL provide settings as a page inside the main window — not a dialog — with the sections General,
Engine, Network, Bandwidth, Queue & seeding, Folders, Tabs & query, Terminal & security, Notifications,
Appearance and About, each with its own address, containing every control listed in the `app-preferences`,
`http-api` settings and `engine-capabilities` requirements. Going back SHALL return to the view the user came
from. A search field SHALL find settings by name or description across all sections and lead to the matching
row. Each row SHALL carry a one-line explanation. Controls unsupported by the active engine SHALL stay visible,
disabled, with a "not supported by <engine>" hint.

Settings SHALL be loaded from and saved to the API without a page-wide Save button:
- an ordinary change SHALL be saved as soon as it is made, with a visible saved confirmation on that row, and
  SHALL be reverted on that row with the error when the server rejects it;
- a change that restarts the engine SHALL NOT be sent immediately: the page SHALL show a "restart required"
  notice naming what changed, with "Later" and "Restart engine", and SHALL send it when the user chooses to
  restart; leaving settings with such changes pending SHALL ask before discarding them;
- changes to authentication (on/off, username, password), bind address, port and allowed hosts SHALL be sent
  only on an explicit Apply; the UI SHALL show a notice when `restartRequired` is returned and SHALL warn before
  applying when the bind address is non-loopback while auth is disabled.
The Engine section SHALL show the current engine, its version and connection status and offer "Test connection"
for Transmission. The Network section SHALL offer a port reachability test, run only when the user asks, showing
the result and when it was obtained, and a control that picks a random port.

#### Scenario: Enable auth
- **WHEN** the user enables auth with username and password and applies
- **THEN** settings persist and the user stays logged in

#### Scenario: Exposed without auth warning
- **WHEN** the user sets bind address to `0.0.0.0` with auth disabled
- **THEN** the UI shows a warning before applying

#### Scenario: Speed limit applied
- **WHEN** the user sets maximum download speed to 100 KB/s
- **THEN** the row shows it was saved without any Save button, and the aggregate download rate settles at or
  below ~100 KB/s

#### Scenario: Test Transmission connection
- **WHEN** the user enters an unreachable host and clicks "Test connection"
- **THEN** the UI shows the failure message without saving

#### Scenario: Section address
- **WHEN** the user opens the address of the Network section, or reloads while on it
- **THEN** the settings page opens on Network

#### Scenario: Back to the tab
- **WHEN** the user opens settings from the "Active" tab and goes back
- **THEN** "Active" is shown again

#### Scenario: Engine restart is deferred
- **WHEN** the user changes the listen port from 6881 to 51413
- **THEN** a notice says a restart is required and names the change, the engine keeps running on 6881, and it
  restarts on 51413 only after the user chooses "Restart engine"

#### Scenario: Rejected value
- **WHEN** the server rejects a changed value as invalid
- **THEN** that row shows the error and returns to its previous value; other rows are unaffected

#### Scenario: Search settings
- **WHEN** the user types `proxy` in the settings search
- **THEN** the proxy rows are listed with their section, and choosing one opens that section at that row

#### Scenario: Unsupported row stays visible
- **WHEN** the active engine offers no HTTP proxy
- **THEN** the HTTP proxy row is shown disabled with "not supported by <engine>"

#### Scenario: Port test unsupported
- **WHEN** the active engine cannot test port reachability
- **THEN** the test control is disabled with the hint and no result is claimed

### Requirement: Login screen
When auth is enabled and the user is not authenticated, the UI SHALL show a login form; on success it SHALL show the torrent list. When auth is disabled, no login form SHALL ever appear. The UI SHALL offer a Log out action when auth is enabled.

#### Scenario: Session expired
- **WHEN** any API call returns 401
- **THEN** the UI switches to the login form, and after login returns to the list

### Requirement: One palette surface
`⌘T` SHALL open a single centered panel over a dimmed, blurred window that serves as jump surface, filter
entry and command palette. Plain text SHALL rank jump targets (tabs and torrents, with a pinned "All
torrents" entry always available) and SHALL NOT filter the list until the user chooses a filter result or
presses `⇥`. Input that parses as a structured query SHALL switch the panel to grouped sections. Outside query
mode the footer SHALL show `↑↓ navigate · ⏎ run · ⇥ switch section · ⌘K shortcut sheet · esc dismiss`; in query
mode it SHALL show `↑↓ navigate · ⏎ open · ⌘S save as tab · ⇧⏎ show all · ⇥ lens · esc dismiss`. Escape SHALL
dismiss and restore focus.

#### Scenario: Plain text jumps, never filters
- **WHEN** the user types `ubuntu` and presses `⏎` on the torrent result
- **THEN** the app navigates to that torrent and the list's lens is unchanged

#### Scenario: Query engages grouped mode
- **WHEN** the user types `state:paused`
- **THEN** the panel shows the grouped sections without any extra keypress

#### Scenario: Query-mode footer
- **WHEN** the input parses as a structured query
- **THEN** the footer reads `↑↓ navigate · ⏎ open · ⌘S save as tab · ⇧⏎ show all · ⇥ lens · esc dismiss`

### Requirement: Grouped sections never mix
In query mode the panel SHALL show, in order: CREATE TAB FROM THIS QUERY (marked "recommended"), FILTER RESULTS ·
ALL TORRENTS (with the match count), JUMP TO (with the number of name matches; omitted when empty) and ACTIONS
(labelled "apply to the N matches"). FILTER RESULTS SHALL list the first 3 torrents of the whole library that match
the query, each with its size, ratio, tracker and state, followed by a "Show all N matches" row. JUMP TO SHALL list
tabs whose name or query contains one of the query's values, or whose query contains or is contained in the typed
query, and files whose names contain one of the query's values, each file naming its torrent. Registered
selection, tab and global commands SHALL NOT appear in query mode. `↑↓` SHALL move through all rows across
sections, and the cursor SHALL start on the first matching torrent, or on the first row when nothing matches. `⏎`
on a torrent SHALL open it; `⏎` on a tab SHALL activate it; `⏎` on a file SHALL open that torrent's Files section
with the file in view.

#### Scenario: Scope labels as drawn
- **WHEN** the query is `state:active tag:4k size:>4GB sort:ratio` and 41 of 312 torrents match
- **THEN** the panel shows CREATE TAB FROM THIS QUERY "recommended", then FILTER RESULTS · ALL TORRENTS "41
  matches" with 3 torrent rows and "Show all 41 matches · ⇧⏎", then JUMP TO, then ACTIONS "apply to the 41
  matches" with "Pause all matches · ⌘P" and "Add tag to all matches… · ⌘L"

#### Scenario: Torrent opens
- **WHEN** the user presses `⏎` right after typing the query
- **THEN** the app navigates to the first matching torrent and the list's lens is unchanged

#### Scenario: File jump
- **WHEN** a file named `ratio-watchlist.txt` exists in a torrent and the query contains the value `ratio`
- **THEN** JUMP TO lists `ratio-watchlist.txt` with the name of its torrent

#### Scenario: No selection
- **WHEN** the query is `state:paused`, with or without a torrent selected
- **THEN** "Pause selected torrent", "Pause all in this tab" and "Pause everything" are not listed

### Requirement: Palette filter results are lens applications
In query mode, `⇥` SHALL apply the parsed query as a lens in the active tab, and the "Show all N matches" row
(`⇧⏎` or click) SHALL activate the pinned All tab and apply the same lens. Applying SHALL close the panel and
render the lens as chips in the filter bar. Neither SHALL create or modify a sidebar tab.

#### Scenario: Apply as lens
- **WHEN** the query is `state:paused` with tab Active open and the user presses `⇥`
- **THEN** the Active tab shows its paused rows and a `state:paused` chip, and the sidebar is unchanged

#### Scenario: Global escape hatch
- **WHEN** the user presses `⇧⏎` or clicks "Show all N matches"
- **THEN** the All tab becomes active with the same lens applied

### Requirement: Create tab from the palette
The CREATE TAB FROM THIS QUERY section SHALL contain exactly one highlighted result — "Save as smart tab" (`⌘S`) —
with an editable tab name prefilled from the values of the query's `field:value` predicates (no comparisons, ranges
or `sort:`), joined with ` · `. It SHALL be the only palette result that writes to the sidebar. The tab SHALL be
created with the query and the name shown; an empty name SHALL mean the tab is named by its query. Creating SHALL
NOT activate the new tab or change the current lens. When a tab with the same query already exists, the row SHALL
name that tab and running it SHALL activate it instead of creating another.

#### Scenario: Prefilled name
- **WHEN** the query is `state:active tag:4k size:>4GB sort:ratio`
- **THEN** the name field reads `active · 4k`

#### Scenario: Only write path
- **WHEN** the user presses `⌘S` for `state:paused`
- **THEN** a smart tab named `paused` appears in the sidebar, and the current tab and lens stay as they were

#### Scenario: Name cleared
- **WHEN** the user clears the name field and runs the result
- **THEN** the new tab is named by its query

### Requirement: Command registry and shortcut sheet
Every GUI command SHALL exist in one command registry with id, label, icon, scope, keybinding and run
function; the palette, global hotkeys and the `⌘K` shortcut sheet SHALL all read that registry. The shortcut
sheet SHALL list each command's keybinding and scope.

#### Scenario: Completeness
- **WHEN** any action button renders in the GUI
- **THEN** a corresponding registry entry exists (enforced by test)

#### Scenario: Shortcut sheet
- **WHEN** the user presses `⌘K`
- **THEN** the sheet lists the commands grouped by scope with their keys

### Requirement: Keyboard map
Every surface SHALL be operable without a mouse. The UI SHALL provide at least: open the palette; jump to the
nth sidebar tab; next and previous tab; new tab; save the lens as a tab; rename the active tab; collapse the
sidebar; focus the filter input; open the filter builder; clear the lens; undo the last chip change; move the
row cursor, extend the selection and select all rows the lens shows; open the selected torrent; pause or
resume the selection; remove with confirmation; add a tag to the selection; back and forward; open settings.
The shortcut sheet SHALL list every binding grouped by surface with its scope, and SHALL show the bindings
that work in the current environment (the platform's modifier keys, and the fallback where a browser reserves
the desktop binding). A shortcut SHALL NOT fire while the user is typing in a text field unless it uses a
modifier.

#### Scenario: Shortcut sheet groups
- **WHEN** the user opens the shortcut sheet
- **THEN** it lists the bindings by group — palette, tabs, lens, list, navigation — each with its scope

#### Scenario: Platform modifiers
- **WHEN** the UI runs on Windows or Linux
- **THEN** the sheet and every keybinding hint show Ctrl and Alt rather than ⌘ and ⌥

#### Scenario: Typing guard
- **WHEN** the user types `p` in the filter input
- **THEN** no pause shortcut fires

### Requirement: Window controls
Inside the desktop window, the UI SHALL show close (hide to tray), minimize and maximize buttons styled for the
OS it runs on:

- macOS: red, yellow and green dots at the top of the sidebar, in that order. While the sidebar is collapsed the
  dots SHALL move into the top bar.
- Windows: three caption buttons (minimize, maximize, close), each 46×32 px, flush in the window's top-right
  corner. A hovered button SHALL get a highlighted background, and a hovered close button SHALL turn red.
- Linux: three round 24 px buttons (minimize, maximize, close) with a filled background, 8 px apart, centered
  vertically in the top bar and 14 px from the window's right edge.

On Windows and Linux the buttons SHALL stay at the right end of the top bar in every view, including a collapsed
sidebar, the detail page and settings. No dots SHALL appear in the sidebar head. The top bar content SHALL NOT
run under the buttons. While the window is maximized, the maximize button SHALL show a restore icon and label.
Every button SHALL have an accessible label. The empty areas of the sidebar head and of the top bar SHALL drag
the window, and double-clicking them SHALL toggle maximize. Interactive elements, the window buttons included,
SHALL NOT start a drag. In a plain browser no window buttons SHALL be rendered on any OS.

#### Scenario: Drag window
- **WHEN** the user drags the empty area of the top bar
- **THEN** the window moves; clicking the Spotlight trigger does not move it

#### Scenario: No dots in a browser
- **WHEN** the UI is opened in a regular browser tab
- **THEN** no red, yellow or green window dots are shown

#### Scenario: No window buttons in a browser on Windows or Linux
- **WHEN** the UI is opened in a regular browser tab on Windows or Linux
- **THEN** no minimize, maximize or close buttons are shown

#### Scenario: Collapsed sidebar
- **WHEN** the user collapses the sidebar in the desktop window
- **THEN** the window buttons are still visible and working: in the top bar on macOS, and unchanged at the top
  bar's right end on Windows and Linux

#### Scenario: Windows caption buttons
- **WHEN** the desktop app runs on Windows
- **THEN** minimize, maximize and close buttons appear in the top-right corner, and no dots appear in the sidebar
  head

#### Scenario: Windows close hover
- **WHEN** the pointer rests on the close button on Windows
- **THEN** the button background turns red

#### Scenario: Linux buttons
- **WHEN** the desktop app runs on Linux
- **THEN** three round minimize, maximize and close buttons appear at the right end of the top bar, and no dots
  appear in the sidebar head

#### Scenario: Close hides to tray
- **WHEN** the user clicks the close button on Windows or Linux
- **THEN** the window hides and the app keeps running in the tray

#### Scenario: Restore icon while maximized
- **WHEN** the window is maximized on Windows or Linux
- **THEN** the maximize button shows a restore icon and its label reads "Restore window"; clicking it restores the
  window size and the icon returns to maximize

#### Scenario: Top bar content stays clear
- **WHEN** the window is narrow on Windows or Linux and the top bar holds many controls
- **THEN** no top bar control is drawn under or behind the window buttons

#### Scenario: Buttons do not drag
- **WHEN** the user presses a window button and moves the pointer
- **THEN** the window does not move

### Requirement: Add torrent dialog
Adding a torrent SHALL happen inside the Spotlight panel, not in a separate dialog. When the Spotlight input
holds a magnet link or a `.torrent` URL, when a `.torrent` file is chosen with the panel's "Add .torrent" control,
or when a `.torrent` file is dropped anywhere on the window, the panel SHALL fetch a preview from the server and
grow downward with its top edge and input in place into the add flow: a header (name, size, file count, hash,
created date), sections Files, Trackers, Options and Advanced, a file list with checkboxes, per-file priority,
Select all / Select none / Invert and its own filter bar using the file-scoped query fields, the save path
(default from settings) with free space, and the options start immediately, create subfolder, priority and tags.
"Add & start" SHALL add the torrent with only the selected files wanted; "Add paused" SHALL add it paused;
Cancel or Escape SHALL return the panel to its input-only state without adding. Options the active engine does
not support SHALL be disabled with the "not supported by <engine>" hint. Adding a torrent SHALL NOT change the
active tab or its lens. While the preview is loading the panel SHALL show a loading line and SHALL NOT change
height.

#### Scenario: Add with file selection
- **WHEN** the user pastes a magnet into Spotlight, unchecks two files in the expanded panel and chooses
  "Add & start"
- **THEN** the torrent is added, those two files are reported as not wanted, and the panel closes

#### Scenario: Add paused
- **WHEN** the user chooses "Add paused"
- **THEN** the torrent is added with status `paused`

#### Scenario: Drop a file on the window
- **WHEN** the user drops a `.torrent` file on the list while Spotlight is closed
- **THEN** Spotlight opens already showing the add flow for that file

#### Scenario: Filter the file list
- **WHEN** the user types `ext:mkv size:>1GB` in the add flow's file filter
- **THEN** only matching files are listed, the count reads how many of the total are shown, and files hidden by
  the filter keep their checked state

#### Scenario: Duplicate torrent
- **WHEN** the previewed torrent's id is already in the library
- **THEN** the panel says so, offers to jump to that torrent, and offers no add action

#### Scenario: Metadata does not resolve
- **WHEN** a magnet's metadata has not arrived after 30 seconds
- **THEN** the panel stays open and offers to add the torrent anyway under the name from the magnet link

#### Scenario: Lens untouched
- **WHEN** a torrent is added while the active tab has a lens applied
- **THEN** the same tab is active with the same chips afterwards

### Requirement: Terminal panel
The Terminal button SHALL toggle a terminal panel (hidden while details are open) that executes commands against the API: `help`, `list` (id prefix, name, status, progress), `status` (rates, active/total, ratio), `add <magnet|url>`, `pause|resume|remove <id-prefix>`, `clear`, and `exit` (closes the panel). Unknown commands print `Command not found: <cmd>`. API errors are printed.

#### Scenario: Add from terminal
- **WHEN** the user runs `add magnet:?xt=urn:btih:...`
- **THEN** the terminal prints the new id and the torrent appears in the list

### Requirement: Status bar
The status bar SHALL show total download and upload rate, session ratio, free space of the default download directory, server CPU % and memory, and `<N> torrents • <M> active`, refreshed with the list.

#### Scenario: Free space
- **WHEN** the download directory's disk has 1.2 TB free
- **THEN** the status bar reads `1.2 TB free`

### Requirement: Localized and themed UI
All UI strings SHALL come from per-language dictionaries (en, fr, de, es, ru, zh) selected by the language
preference, falling back to English for missing keys. The UI SHALL render in a dark or a light mode chosen by
the `appearance.mode` preference (`system` follows the OS preference and switches live), with the accent color
chosen by `appearance.accent`. Every surface — list, sidebar, Spotlight, add flow, filter builder, empty states,
dialogs — SHALL be legible in both modes; no surface SHALL exist in one mode only. Query text, ids, hashes,
paths and numeric values SHALL use the monospace face and other UI text the sans face; both faces SHALL be
served by TorrentX itself. Dates SHALL render in the chosen format (relative, absolute, ISO).

#### Scenario: Switch language
- **WHEN** the user selects Deutsch
- **THEN** menus, headers and buttons render in German without reload

#### Scenario: Follow the system
- **WHEN** `appearance.mode` is `system` and the OS switches from dark to light
- **THEN** the UI switches to light without a reload

#### Scenario: Light parity
- **WHEN** the mode is `light` and the user opens Spotlight over a filtered tab
- **THEN** the panel, chips, list rows and status colors are all readable, with no dark-only surface left

#### Scenario: Offline fonts
- **WHEN** the server has no internet access
- **THEN** the UI renders with its own sans and mono faces and requests no font from another host

### Requirement: Browser notifications
When desktop notifications are enabled and the UI is running in a browser, the UI SHALL request Notification permission and show a notification when a torrent completes (if "notify on complete") or is added (if "notify on add"), and play a short sound on completion if enabled. It SHALL NOT notify for the same event twice across polls.

#### Scenario: Completion notification
- **WHEN** a torrent's progress reaches 1 while the page is open and notifications are allowed
- **THEN** exactly one notification "<name> finished" is shown

### Requirement: Palette file mode
In the `⌘T` palette, typing `@` as the first character of an empty input followed by Space SHALL switch the
palette to file mode: the `@` becomes a mode chip labelled "files", the placeholder changes to a file-search
hint, and the text after the chips is evaluated as a file-search query against the files of every torrent.
Plain words SHALL match file names; field predicates SHALL use the file-search scope (`torrent-query`).
Results SHALL be ranked by the palette's existing score on the file name, then by torrent order, and limited
to 50 rows with a line stating how many more matched. With no scope chip and an empty query the palette SHALL
show a hint instead of results. Backspace on an empty input SHALL remove the last chip, and removing the mode
chip SHALL return to the normal palette. File mode SHALL NOT change the list, the lens or the sidebar.

#### Scenario: Enter file mode
- **WHEN** the user opens the palette, types `@` and presses Space
- **THEN** a "files" chip appears in the input and the placeholder asks for a file name

#### Scenario: Search all torrents
- **WHEN** in file mode the user types `s01e04 ext:srt`
- **THEN** the results list the matching subtitle files from every torrent, each naming its torrent

#### Scenario: `@` elsewhere is text
- **WHEN** the user types `foo @` in the normal palette
- **THEN** the palette stays in its normal mode

#### Scenario: Leave file mode
- **WHEN** the input is empty in file mode and the user presses Backspace until no chip is left
- **THEN** the palette is back in its normal mode with an empty input

### Requirement: Torrent scope picker
In file mode, typing `torrent:` followed by Space SHALL switch the palette to choosing a torrent: the input
shows a pending `torrent:` chip, results are the torrents ranked by name across all torrents (not only the
active tab), and `⏎` on a torrent SHALL replace the pending chip with a `torrent:<name>` scope chip bound to
that torrent's id, put back any file query typed before `torrent:` (empty otherwise) and return to file search
within that torrent only. With a scope chip and
an empty query, the palette SHALL list that torrent's files in the torrent's own file order. Escape or Backspace
on an empty picker input SHALL drop the pending chip and return to file search. Typing `torrent:<text>` without
the trailing Space SHALL be an ordinary predicate on the torrent name.

#### Scenario: Pick a torrent
- **WHEN** in file mode the user types `torrent:`, presses Space, types `expanse` and presses `⏎` on
  "The Expanse S01"
- **THEN** the input shows the chips "files" and "torrent: The Expanse S01", and the results list that torrent's
  files only

#### Scenario: Search within the picked torrent
- **WHEN** the scope chip is set and the user types `e04`
- **THEN** only files of that torrent whose name contains `e04` are listed, without a torrent-name column

#### Scenario: Predicate, not picker
- **WHEN** in file mode the user types `torrent:ubuntu iso` without a Space right after `torrent:`
- **THEN** files whose torrent name contains `ubuntu` and whose name contains `iso` are listed and no picker opens

### Requirement: File mode starts scoped on a torrent page
When the palette is opened on a torrent's detail page, entering file mode SHALL pre-add the scope chip for that
torrent, so the search starts within it. Backspace on an empty input SHALL remove that chip and widen the search
to all torrents.

#### Scenario: Scoped by default
- **WHEN** the user is on the detail page of "Ubuntu 24.04", presses `⌘T`, types `@` and Space
- **THEN** the chips "files" and "torrent: Ubuntu 24.04" are shown and that torrent's files are listed

#### Scenario: Widen the search
- **WHEN** the user then presses Backspace on the empty input
- **THEN** the torrent chip is removed and the query searches all torrents

### Requirement: Compact file result rows
File results SHALL use the Files section's row in a compact, single-line form: format icon, file name, the
torrent name (only when no scope chip is set), size, a done bar with percent (or `done`), and the priority word
(`skip` for unwanted files). Long file names and torrent names SHALL be trimmed in the middle with `…`, keeping
the beginning and the extension (and any episode code like `S01E04` when present), so that the row never wraps;
the tooltip and accessible label SHALL carry the full path and torrent name. Rows SHALL have one fixed height
and the keyboard cursor SHALL move through them like other palette rows.

#### Scenario: Middle trim keeps the extension
- **WHEN** a file is named `The.Expanse.S01E04.CQB.1080p.BluRay.x264-DEMAND.Extended.Cut.Remastered.mkv`
- **THEN** the row shows the start of the name, `…`, and the end including `.mkv` on one line, and the tooltip
  shows the full path

#### Scenario: Unwanted file
- **WHEN** a matching file is not wanted
- **THEN** its row shows the priority word `skip` in the muted tone

### Requirement: Open a file result
`⏎` or a click on a file result SHALL close the palette, open that torrent's Files section and scroll the file
into view with a temporary highlight. It SHALL NOT change the Files section's filter, the list's lens or the
active tab. The browser back action SHALL return to the view the palette was opened from.

#### Scenario: Jump to the file
- **WHEN** the user presses `⏎` on `S01E04.srt` of "The Expanse S01"
- **THEN** the detail page of that torrent shows the Files section with `S01E04.srt` highlighted and visible

#### Scenario: Back returns
- **WHEN** the user then goes back
- **THEN** the previous tab or page is shown as it was

### Requirement: Shell chrome
The window SHALL be a browser-style shell: a left sidebar (collapse control, "Search or paste magnet ⌘T"
trigger, PINNED / SMART TABS / AD-HOC tab sections with live counts and lens badges, collapsible groups,
`+ New tab ⌘⇧T`, `Save current lens as tab ⌘S`, and total down/up transfer rates at the bottom); a top bar
(back/forward, the active tab title with a `lens · N filters` badge and "scoped to this tab" caption when a
lens is active, and density / terminal / settings / account controls); and a status bar (`N of M torrents
match this tab + lens`, the engine name with its state, free space of the download volume, and a collapsed
terminal handle with its shortcut). Total down/up rates SHALL sit at the foot of the sidebar, with session
ratio, server CPU % and memory reachable from there. Window controls SHALL render only in the desktop app.

#### Scenario: Lens badge
- **WHEN** the active tab has three lens predicates
- **THEN** the top bar shows `lens · 3 filters` and the sidebar tab shows its funnel badge

#### Scenario: Match count
- **WHEN** 9 of 312 torrents match the tab query plus lens
- **THEN** the status bar reads "9 of 312 torrents match this tab + lens"

### Requirement: Filter bar and lens chips
Each tab SHALL have a filter bar under the top bar: a fuzzy name input, a funnel button with the predicate
count, an always-visible wrapping chip row rendered from the lens AST (including the sort chip), `+ filter`,
`Save as tab`, and a collapse control that keeps the chips visible. The lens SHALL be ephemeral and per-tab:
ANDed onto the tab query, cleared when switching tabs (with a session snapshot and a `restore lens` pill on
return), undoable with ⌘Z, and never written to the sidebar. Chips SHALL be removable, negatable with
⌥-click, and navigable with ←/→/⌫.

#### Scenario: Chips as drawn
- **WHEN** the lens is `state:active tag:4k size:>4GB sort:ratio desc`
- **THEN** four chips render in that order, the sort chip visually distinct, and the funnel reads 3

#### Scenario: Tab switch clears the lens
- **WHEN** the user switches tabs and returns
- **THEN** the lens is gone and a `restore lens` pill offers it back

#### Scenario: Filtering never mutates the sidebar
- **WHEN** the user types, chips, negates or clears any lens
- **THEN** no sidebar tab is created, renamed or reordered

### Requirement: Filter builder
The funnel button SHALL open a popover that edits the lens as structured rows: each row is a field selector,
an operator selector and a value input, rows joined by a selectable ALL (AND) or ANY (OR), with one nested OR
group supported. The popover SHALL include a sort row, a live preview of the resulting query text with a copy
action, an "Apply lens" action and a "Save as tab" action. Applying predicates built here SHALL produce exactly
the chips that typing the equivalent query produces.

#### Scenario: Build an OR group
- **WHEN** the user adds an ANY group with two tracker rows and applies it
- **THEN** the preview reads `(tracker:a.example OR tracker:b.example)` and the chip row shows the same group

#### Scenario: Builder and text agree
- **WHEN** the user builds `state:active tag:4k size:>4GB sort:ratio desc` in the popover
- **THEN** the chips are identical to those produced by typing that text into the filter bar

### Requirement: Save as tab
Wherever a query exists — the filter bar, the filter builder, the palette and the terminal — the UI SHALL
offer "Save as tab". It SHALL confirm inline (not in a dialog) with an editable name pre-filled from the query
and the query text shown, SHALL create the tab in the active group or the ad-hoc section, SHALL clear the lens
that produced it, and SHALL be undoable for a few seconds. Saving a query identical to an existing tab's SHALL
offer to jump to that tab instead of creating a duplicate. Dismissing the proposal SHALL leave the lens
applied and the sidebar unchanged.

#### Scenario: Save from the filter bar
- **WHEN** the user applies two predicates and chooses "Save as tab", names it "4K active" and confirms
- **THEN** a tab "4K active" with that query appears in the sidebar, the lens is cleared and the new tab lists
  the same torrents

#### Scenario: Duplicate query
- **WHEN** the user saves a query that an existing tab already holds
- **THEN** the UI offers to jump to that tab instead of creating a second one

### Requirement: Navigation history
Every view the user can reach — a tab, and later a torrent page or a settings section — SHALL have its own
address, so that the browser's or the top bar's back and forward move between them and reloading or opening
the address shows the same view. An address SHALL NOT carry a lens. An address naming a tab or torrent that no
longer exists SHALL open the pinned "All" tab and say why.

#### Scenario: Back and forward
- **WHEN** the user opens tab "Seeding", then tab "Active", then presses back
- **THEN** "Seeding" is shown, and forward returns to "Active"

#### Scenario: Reload keeps the view
- **WHEN** the user reloads while tab "4K Movies" is active
- **THEN** "4K Movies" is active after the reload, without any lens

#### Scenario: Stale address
- **WHEN** an address names a tab that was deleted
- **THEN** the "All" tab is shown with a notice that the tab no longer exists

### Requirement: Detail is a page
Opening a torrent (Enter or double-click; single click selects) SHALL navigate to a detail page inside the
shell with breadcrumb `← <tab> / <name>` and its own address per section. Back (button or ⌘[) SHALL restore
the originating tab with its scroll position and lens exactly as left. The under-list details panel SHALL
NOT exist.

#### Scenario: Back restores everything
- **WHEN** the user scrolls the list, applies a lens, opens a torrent and presses ⌘[
- **THEN** the same tab is active with the same chips and the same scroll offset

### Requirement: Status hero
The detail hero SHALL show the format icon, name, a meta line (state word, size, file count, tracker, added
age, info-hash, save path), the actions Pause/Resume, Verify, Reveal, Remove and an overflow menu, the big
progress percent, and a stat strip: progress, transferred (`X of Y`), eta, down, up, seeds (`connected of
known`), peers (`connected of known`), ratio — updating live without layout shift.

#### Scenario: Hero as drawn
- **WHEN** the torrent of screen 09 is open
- **THEN** the strip reads 68.4% progress, 28.7 GB of 42.1 GB transferred, 18m 04s eta, ↓ 12.4 MB/s,
  ↑ 1.1 MB/s, 48 of 112 seeds, 12 of 31 peers, 1.84 ratio

### Requirement: Section tabs and mini filter bars
The page SHALL have sections Overview, Files, Peers, Trackers, Web seeds, Pieces, each with a live count and
its own address. Every table section SHALL have a mini filter bar using the shared query language with the
section's own fields, removable chips, a sort chip and a shown-of-total count stating the lens is scoped to
the section. Section lenses SHALL be ephemeral, never saved, and cleared on leaving the section.

#### Scenario: Section lens
- **WHEN** the user filters Peers with `country:!CN flags:!snubbed sort:down desc`
- **THEN** the count reads "48 of 112 peers · lens scoped to this section" and the list tab's lens is
  untouched

### Requirement: Files section
Files SHALL show a format label and view switcher, columns NAME, SIZE, DONE, PRIORITY, ACTIONS, a wanted
checkbox and type icon per row, and a priority menu (high / normal / low / skip). Row actions SHALL follow the
file format: video → play / add to library / cast; iso and archives → show contents / mount; everything else
→ open / reveal / copy path. Unsupported actions SHALL be disabled with the engine or platform hint, never
hidden. Fields `ext:`, `priority:`, `ep:`, `season:` SHALL filter the rows.

#### Scenario: Priority and skip
- **WHEN** the user sets a subtitle file to skip
- **THEN** its checkbox unchecks, the row reads `skip`, and the engine reports the file as not wanted

#### Scenario: Format-aware actions
- **WHEN** a row is an `.mkv` video and another is a `.nfo`
- **THEN** the video offers play / library / cast and the nfo offers open / reveal / copy path

### Requirement: Media mode
When a torrent's video files parse as episodes of one show, Files SHALL offer a media view: season picker,
episode strip (numbers hidden by the lens rendered dashed), and one row per episode with code, title and
duration only when known, quality tags parsed from the filename, size, progress, a state word (ready to play
/ downloading / queued / skipped), and Play / Library / Cast / overflow actions, plus a featured play button
for the first ready episode. The view SHALL be switchable back to the plain list with the lens intact, and
SHALL NOT invent titles, durations or quality tags.

#### Scenario: Lens dashes the strip
- **WHEN** the section lens is `ep:>3` on a 9-episode season
- **THEN** strip numbers 1–3 render dashed and only episodes 4–9 list

#### Scenario: Nothing invented
- **WHEN** an episode's title or duration is unknown
- **THEN** the row shows only its code and the known facts

### Requirement: Peers section
Peers SHALL show columns IP:PORT, COUNTRY (code and name), CLIENT, PROGRESS, DOWN, UP, FLAGS and ENC, with
flag letters (D downloading from, U uploading to, I incoming, E encrypted, K unchoked, S snubbed, ? unknown)
explained by a legend, and the cipher or `—` in ENC. Unknown countries SHALL render `—`. Fields `country:`,
`client:`, `flags:` SHALL filter; rates SHALL sort.

#### Scenario: Flags and legend
- **WHEN** a peer is downloading, uploading and encrypted
- **THEN** its FLAGS cell shows D U E and the legend explains each letter

### Requirement: Trackers and web seeds sections
Trackers SHALL show a header with announced/failing counts and an Add tracker action, columns TRACKER URL,
TIER, STATUS, SEEDS, LEECH, DOWNLOADED, LAST, NEXT, statuses working / updating / not working, the engine's
failure reason under failing rows with a re-announce action, and DHT/PeX as pseudo-rows with tier `—`.
Web seeds SHALL show configured/failing counts, Add web seed, columns URL, TYPE (BEP 19 / BEP 17), STATUS,
SPEED, DOWNLOADED, and failure reasons. Add/re-announce actions SHALL be capability-gated with the engine
hint; fields the engine does not report SHALL render `—`.

#### Scenario: Failing tracker
- **WHEN** a tracker refuses the torrent
- **THEN** its row reads "not working" with the reason "tracker refused: torrent not registered (code 200)"
  and a re-announce action

#### Scenario: Web seed failure
- **WHEN** a web seed returns HTTP 404
- **THEN** its row reads failed with "HTTP 404 — url no longer serves this payload"

#### Scenario: Capability gate
- **WHEN** the engine lacks web-seed support
- **THEN** Add web seed is disabled with "not supported by <engine>"

### Requirement: Query tokens in the palette input
While the palette input parses as a structured query, every `field:value` predicate in it SHALL be drawn as a
token inside the input, with the field and the value styled apart. Text that is not a predicate SHALL be drawn
plain. Typing, the caret, selection and deletion SHALL behave as in a plain text input.

#### Scenario: Tokens while typing
- **WHEN** the user types `state:active tag:4k`
- **THEN** the input shows two tokens, `state:` `active` and `tag:` `4k`, and the caret stays after `4k`

### Requirement: Match-scoped palette actions
In query mode the ACTIONS section SHALL offer "Pause all matches" (`⌘P`) and "Add tag to all matches…" (`⌘L`),
acting on every torrent in the library that matches the query. These keys SHALL apply only while the palette is
open and SHALL NOT trigger their global bindings. Pausing SHALL close the panel and pause each matching torrent
that is not paused. Adding a tag SHALL close the panel and open the tag dialog for the matching torrents. Both SHALL
be disabled with a reason when nothing matches.

#### Scenario: Pause matches
- **WHEN** 41 torrents match and the user presses `⌘P` in the palette
- **THEN** the panel closes and those 41 torrents end up paused; the lens and the active tab are unchanged

#### Scenario: Tag matches
- **WHEN** the user presses `⌘L` in the palette
- **THEN** the panel closes and the tag dialog opens for the matching torrents

#### Scenario: Nothing matches
- **WHEN** the query matches no torrent
- **THEN** both actions are disabled with the reason that nothing matches

### Requirement: Unfinished query in the palette
When the palette input names a known field (`size:`, `state:`, `sort:` …) but does not parse yet, the panel SHALL
stay in query mode as a draft instead of falling back to jump results. The "parses as" strip SHALL show the parse
error, with its suggestion when there is one, and a SUGGESTIONS section SHALL list the completions for the text
before the caret: operators for a numeric field, values for an enum or a tag or tracker field, field names after a
space. `⏎` or `⇥` on a suggestion SHALL insert it into the input and keep the panel open. An unknown field
(`statu:active`) SHALL keep jump mode. As a palette-only shortcut, a `:` starting a word SHALL list the field
names, and `:field` followed by a space SHALL turn into `field:`; the query language itself is unchanged.

#### Scenario: Field with no value yet
- **WHEN** the user types `size:` in the palette
- **THEN** the panel shows the error `missing value for "size"` and the suggestions `>`, `<`, `>=`, `<=`

#### Scenario: Pick a value
- **WHEN** the user types `state:` and presses `⏎` on the suggestion `active`
- **THEN** the input becomes `state:active`, the panel stays open and shows the grouped query sections

#### Scenario: Unknown field
- **WHEN** the user types `statu:active`
- **THEN** the panel shows jump results, as for plain words

#### Scenario: `:` lists the fields
- **WHEN** the user types `:` (or `:si`) in the palette
- **THEN** SUGGESTIONS lists the field names (`size:` for `:si`), and `⏎` on one replaces `:si` with `size:`

#### Scenario: `:size` and a space
- **WHEN** the user types `:size` and then a space
- **THEN** the input becomes `size:` and SUGGESTIONS lists `>`, `<`, `>=`, `<=`; saved queries never contain the
  `:size` form

### Requirement: Cover in the detail hero
When a torrent has a cover, the detail hero SHALL draw it as its background, scaled to cover the hero and
dimmed by an overlay built from theme tokens so that the name, figures and controls keep the same contrast as
without a cover, in dark and in light mode. Without a cover the hero SHALL look as it does today. The hero's
menu SHALL offer "Remove cover" when a cover is shown.

#### Scenario: Cover appears
- **WHEN** the user opens a torrent whose `cover` is set
- **THEN** the hero shows the image behind its content and the text stays readable in both themes

#### Scenario: Cover arrives while open
- **WHEN** a torrent's `cover` changes from `null` to a version while its page is open
- **THEN** the hero shows the image without a reload

#### Scenario: Remove
- **WHEN** the user picks "Remove cover"
- **THEN** the hero returns to its plain look and the cover does not come back

### Requirement: Cover in torrent list rows
A list row whose torrent has a cover SHALL draw it as the row's background, scaled to cover the row and dimmed
with the row's own background token (plain, hovered, selected) so the cells keep their contrast in both themes.
A row without a cover SHALL look as it does today. When a row without a cover comes on screen, the UI SHALL try
to get one by the same steps as the torrent's page (lookup when it is on, else a frame of the largest video
file), once per torrent and session and once more when the torrent completes.

#### Scenario: Row with a cover
- **WHEN** the list shows a torrent whose `cover` is set
- **THEN** its row shows the image behind its cells and the row height is unchanged

#### Scenario: Cover without opening the page
- **WHEN** a seeding video torrent without a cover is on screen in the list on a streaming-capable engine
- **THEN** its row gets a captured frame as background without the user opening the torrent

### Requirement: File covers in the media view
In the Files section's media view, each episode row SHALL show a small thumbnail of the file's cover, and a
placeholder of the same size with the file-kind icon when it has none. The tree view SHALL keep its file-kind
icons and SHALL NOT show thumbnails. Thumbnails SHALL load only for rows that are on screen.

#### Scenario: Mixed rows
- **WHEN** a season has covers for 3 of 10 episodes
- **THEN** 3 rows show thumbnails, 7 show the placeholder, and all rows have the same height

### Requirement: Frame capture
When a video file has no cover, the engine can stream, and enough of the file's start is downloaded to play,
the UI SHALL capture one frame at `min((duration or 600 s) * 0.03, 60 s)` and upload it as the file's cover.
The torrent's frame comes from its largest file among `avi`, `mp4`, `m4v`, `webm`, `mov`, `mkv`, `mpg`, `mpeg`,
`ogv`, `wmv`, `m2ts`. It SHALL do this for
the largest video file when a torrent's page opens without a cover, and for media view rows when they come on
screen, one file at a time, with no sound and no visible player. A file whose capture failed SHALL NOT be
tried again in the same session. Capture SHALL NOT run on an engine that cannot stream.

#### Scenario: First open of a video torrent
- **WHEN** the user opens a streaming-capable video torrent that has no cover and whose largest file can play
- **THEN** within a few seconds the hero shows a frame from that video

#### Scenario: Browser cannot decode
- **WHEN** the browser cannot play the file
- **THEN** the hero keeps its plain look, no error is shown, and no second attempt is made in that session

### Requirement: Automatic lookup from the UI
With the online lookup on, when a torrent's page opens and the torrent has no cover from its own image files,
the UI SHALL request one lookup using the title and year parsed from the name, as a show when the media view
applies and as a movie otherwise; for media view rows on screen it SHALL request the episode image. With the
lookup off the UI SHALL NOT send lookup requests.

#### Scenario: Lookup off
- **WHEN** the lookup is off and the user opens a video torrent
- **THEN** no lookup request is sent

### Requirement: Covers settings group
Settings → Appearance SHALL have a Covers group with "Look up covers online" (off by default) and an API key
field that shows whether a key is stored and never its text. Next to the toggle the group SHALL state what is
sent (title, year, season and episode number, to the named service) and what is not (torrent names, files,
info-hashes). The toggle SHALL NOT be switchable on without a key. While the lookup is on the group SHALL show
the lookup service's attribution.

#### Scenario: No key
- **WHEN** no API key is stored
- **THEN** the toggle is disabled with a hint to enter a key first

#### Scenario: Key stored
- **WHEN** the user saves a key and reopens the settings
- **THEN** the field shows that a key is stored and is empty

### Requirement: Settings page layout
The settings page SHALL show a breadcrumb `← <tab> ⌘[ / Settings / <section>` with the caption "changes save
automatically", a section rail with the sections General, Engine, Network, Bandwidth, Queue & seeding, Folders,
Tabs & query, Terminal & security, Notifications, Appearance, About, and a "Search settings ⌘F" field. Each
section SHALL deep-link (`tx://settings/<section>`). The Engine header SHALL show the engine name, version and
mode with the note that capabilities drive which rows are available. Rows SHALL be grouped under captions that
state scope (e.g. "restart required for port changes", "applies to new connections only").

#### Scenario: Deep link
- **WHEN** the user opens `tx://settings/network`
- **THEN** the page opens on Network with the rail highlighting it

### Requirement: Network section
The Network section SHALL offer: incoming port with an open/closed state chip and a Random action; automatic
port mapping (UPnP / NAT-PMP); a port reachability row showing the result, the age of the last check and
"Test again"; DHT with its node count, Peer exchange and Local peer discovery toggles, each explained in one
line; protocol encryption mode; and proxy type and address. Proxy types the active engine lacks (HTTP, SOCKS4
on rqbit) SHALL remain visible and disabled with "not supported by <engine>".

#### Scenario: Reachability
- **WHEN** the user presses "Test again" on an engine that supports it
- **THEN** the row shows reachable / not reachable and "just now"

#### Scenario: Restart banner as drawn
- **WHEN** the listen port is changed from 6881 to 51413
- **THEN** the banner reads that transfers keep running on the old port until the engine restarts, with Later
  and Restart engine
