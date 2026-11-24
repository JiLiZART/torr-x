## MODIFIED Requirements

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

## ADDED Requirements

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
The Add dialog SHALL have URL, File and Magnet tabs (file also by drag-and-drop onto the window) and options: save path (default from settings), create subfolder, start torrent, priority. "Next" SHALL fetch a preview from the server and show torrent info (name, size, file count, hash, piece size × count, created date, comment, trackers; collapsible) and a file tree with checkboxes plus Select all / Select none. "Add" SHALL add the torrent with only the selected files wanted and the chosen options. Empty input SHALL show a validation error without calling the API.

#### Scenario: Add with file selection
- **WHEN** the user previews a multi-file torrent, unchecks two files and clicks Add
- **THEN** the torrent is added and those two files are reported as not wanted

#### Scenario: Add paused
- **WHEN** "Start torrent" is unchecked
- **THEN** the torrent is added with status `paused`

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
All UI strings SHALL come from per-language dictionaries (en, fr, de, es, ru, zh) selected by the language preference, falling back to English for missing keys. The UI SHALL apply the selected theme (Hacker, Dark Blue, Light), or follow the OS light/dark preference when "use system theme" is on. Dates SHALL render in the chosen format (relative, absolute, ISO).

#### Scenario: Switch language
- **WHEN** the user selects Deutsch and saves
- **THEN** menus, headers and buttons render in German without reload

### Requirement: Browser notifications
When desktop notifications are enabled and the UI is running in a browser, the UI SHALL request Notification permission and show a notification when a torrent completes (if "notify on complete") or is added (if "notify on add"), and play a short sound on completion if enabled. It SHALL NOT notify for the same event twice across polls.

#### Scenario: Completion notification
- **WHEN** a torrent's progress reaches 1 while the page is open and notifications are allowed
- **THEN** exactly one notification "<name> finished" is shown
