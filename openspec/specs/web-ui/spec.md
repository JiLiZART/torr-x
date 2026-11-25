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
The UI SHALL use the vendor layout: header (traffic-light dots, title, search box, Add / Terminal / Settings buttons, global download rate), tab bar, torrent list, optional details panel or terminal, and status bar. The list SHALL show every torrent in the active tab with name, size, progress (bar + percent), seeds, peers, download rate, upload rate and ETA, with a status color stripe (downloading blue, seeding green, paused yellow, error red, other gray). The list SHALL refresh at least every 2 seconds while the page is visible. Clicking a column header SHALL sort by that column (name, size, progress, seeds, peers, download, upload, ETA); clicking it again SHALL reverse the direction; unknown ETA SHALL sort last. The search box SHALL filter the list by case-insensitive name substring. When no torrent matches, the list SHALL show the ASCII-art empty state naming the search term if any. The UI SHALL keep the terminal look (monospace, minimal shadows) in the default theme.

#### Scenario: Live progress
- **WHEN** a torrent is downloading
- **THEN** its progress and rates update in the list without a page reload

#### Scenario: Engine unavailable
- **WHEN** the API returns `engine_unavailable`
- **THEN** the UI shows a visible banner with the error message and a link to settings, instead of an empty list with no explanation

#### Scenario: Sort by size
- **WHEN** the user clicks SIZE twice
- **THEN** the list is ordered by size in bytes descending and a down chevron marks the column

#### Scenario: Search with no result
- **WHEN** the user types `zzz` and no torrent name contains it
- **THEN** the empty state reads `No torrents found in this tab matching "zzz".`

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
The UI SHALL provide a modal settings screen with sections General, Network, Downloads, Remote, Appearance, Advanced and Server, containing every control listed for that section in the `app-preferences`, `http-api` settings and `engine-capabilities` requirements, loaded from and saved to the API. Controls unsupported by the active engine SHALL be disabled with a hint. After saving, the UI SHALL show a saved confirmation, a notice when `restartRequired` is returned, and SHALL warn when the bind address is non-loopback while auth is disabled. The Remote section SHALL show the current Transmission connection status and offer a "Test connection" button.

#### Scenario: Enable auth
- **WHEN** the user enables auth with username and password and saves
- **THEN** settings persist and the user stays logged in

#### Scenario: Exposed without auth warning
- **WHEN** the user sets bind address to `0.0.0.0` with auth disabled
- **THEN** the UI shows a warning before saving

#### Scenario: Speed limit applied
- **WHEN** the user sets maximum download speed to 100 KB/s and saves
- **THEN** the aggregate download rate shown in the status bar settles at or below ~100 KB/s

#### Scenario: Test Transmission connection
- **WHEN** the user enters an unreachable host and clicks "Test connection"
- **THEN** the UI shows the failure message without saving

### Requirement: Login screen
When auth is enabled and the user is not authenticated, the UI SHALL show a login form; on success it SHALL show the torrent list. When auth is disabled, no login form SHALL ever appear. The UI SHALL offer a Log out action when auth is enabled.

#### Scenario: Session expired
- **WHEN** any API call returns 401
- **THEN** the UI switches to the login form, and after login returns to the list

### Requirement: One palette surface
`⌘T` SHALL open a single centered panel over a dimmed, blurred window that serves as jump surface, filter
entry and command palette. Plain text SHALL rank jump targets (tabs and torrents, with a pinned "All
torrents" entry always available) and SHALL NOT filter the list until the user chooses a filter result or
presses `⇥`. Input that parses as a structured query SHALL switch the panel to grouped sections. The footer
SHALL show `↑↓ navigate · ⏎ run · ⇥ switch section · ⌘K shortcut sheet · esc dismiss`; Escape SHALL dismiss
and restore focus.

#### Scenario: Plain text jumps, never filters
- **WHEN** the user types `ubuntu` and presses `⏎` on the torrent result
- **THEN** the app navigates to that torrent and the list's lens is unchanged

#### Scenario: Query engages grouped mode
- **WHEN** the user types `state:paused`
- **THEN** the panel shows the grouped sections without any extra keypress

### Requirement: Grouped sections never mix
In query mode the panel SHALL show, in order: ACTIONS (registered GUI commands with icon, scope label and
keybinding), FILTER (the query as a lens application), JUMP TO (matching tabs and torrents with context
lines), CREATE TAB (save the query as a smart tab). Actions and filters SHALL never appear inside one
section. Selection-scoped commands SHALL be disabled with a reason when nothing is selected; tab-scoped
commands SHALL name the active tab.

#### Scenario: Scope labels as drawn
- **WHEN** the query is `state:paused` with a torrent selected in tab Active
- **THEN** ACTIONS shows "Pause selected torrent · selection · Space", "Pause all in this tab · tab ·
  Active · ⌘⇧P", "Pause everything · global · ⌘⌥P" and "Resume paused in this tab · ⌘⇧R"

#### Scenario: No selection
- **WHEN** nothing is selected
- **THEN** "Pause selected torrent" is disabled with the reason, and the other commands remain available

### Requirement: Palette filter results are lens applications
The FILTER section SHALL offer the parsed query as a lens in the active tab with its live match count,
applied with `⇥` or click, and a variant "in All torrents" (`⇧⏎`) that activates the pinned All tab and
applies the same lens. Applying SHALL close the panel and render the lens as chips in the filter bar.
Neither variant SHALL create or modify a sidebar tab.

#### Scenario: Apply as lens
- **WHEN** the user presses `⇥` on `state:paused · lens · tab “Active” · 6 matches`
- **THEN** the Active tab shows 6 rows and a `state:paused` chip, and the sidebar is unchanged

#### Scenario: Global escape hatch
- **WHEN** the user presses `⇧⏎` on the All-torrents variant
- **THEN** the All tab becomes active with the same lens applied

### Requirement: Create tab from the palette
The CREATE TAB section SHALL contain exactly one highlighted result — `Save “<query>” as a smart tab`
(`⌘S`) — and it SHALL be the only palette result that writes to the sidebar. Creating SHALL NOT activate the
new tab or change the current lens.

#### Scenario: Only write path
- **WHEN** the user runs the Create-tab result for `state:paused`
- **THEN** a smart tab named from the query appears in the sidebar, the current tab and lens stay as they
  were

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
Inside the desktop window, the header's red, yellow and green dots SHALL close (hide to tray), minimize and toggle maximize the window, the header background SHALL drag the window, and double-clicking it SHALL toggle maximize; interactive header elements (search, buttons) SHALL NOT start a drag. In a plain browser the dots SHALL render but do nothing.

#### Scenario: Minimize from header
- **WHEN** the user clicks the yellow dot in the desktop window
- **THEN** the window minimizes

#### Scenario: Drag window
- **WHEN** the user drags the header's empty area
- **THEN** the window moves; typing in the search box does not move it

### Requirement: Tab bar
The UI SHALL show the built-in tabs All Torrents, Downloading (status `downloading`) and Completed (progress = 1), followed by user tabs from the server, and a "+" button. "+" SHALL create a tab named "Tab N" and activate it. Double-clicking a tab name SHALL edit it in place: Enter or blur saves (empty → auto "Tab N"), Escape cancels. Each tab SHALL have a delete "x" while more than one tab exists. Dragging a torrent row onto a tab SHALL highlight the tab and, on drop onto a user tab, assign the torrent to it. A user tab SHALL list only the torrents assigned to it.

#### Scenario: Drag to tab
- **WHEN** the user drags a torrent row onto user tab "Linux"
- **THEN** the torrent appears when "Linux" is active, also after a page reload and in another browser

#### Scenario: Rename by double-click
- **WHEN** the user double-clicks "Tab 4", types "Movies" and presses Enter
- **THEN** the tab reads "Movies" after reload

### Requirement: Details panel
Selecting a torrent SHALL open a details panel with tabs General, Trackers, Peers, Seeds and Files, and a close button.
- General: status, progress, size, downloaded, uploaded, ratio, rates, ETA, seeds, peers, added, save path, hash, pieces × piece size, availability, wasted, creator, comment, created date, primary tracker; a live download/upload speed graph over the last 60 samples (hidden when "show speed graph" is off); a piece map with one cell per piece bucket (have / partial / missing; hidden when "show piece visualization" is off).
- Trackers: URL, status, last announce, seeds/peers reported, next announce; an "Add tracker" input.
- Peers: address, country, client, progress, download/upload rate, flags; Seeds: the same list filtered to peers with progress 1.
- Files: tree grouped by path segments with expand/collapse per folder and Expand all / Collapse all; per file size, progress and priority; a per-file menu with High / Normal / Low priority and Skip file.
The panel SHALL refresh while open.

#### Scenario: Skip file
- **WHEN** the user chooses "Skip file" on one file of a multi-file torrent
- **THEN** the file is marked skipped, stops downloading, and the torrent's remaining size shrinks

#### Scenario: Add tracker
- **WHEN** the user adds `udp://tracker.example:1337/announce` under an engine that supports it
- **THEN** the tracker appears in the Trackers list

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
