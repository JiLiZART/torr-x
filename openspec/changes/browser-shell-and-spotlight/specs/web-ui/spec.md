## MODIFIED Requirements

### Requirement: Window controls
Inside the desktop window, red, yellow and green dots at the top of the sidebar SHALL close (hide to tray),
minimize and toggle maximize the window; the empty areas of the sidebar head and of the top bar SHALL drag the
window, and double-clicking them SHALL toggle maximize; interactive elements (Spotlight trigger, buttons, tabs,
inputs) SHALL NOT start a drag. While the sidebar is collapsed the dots SHALL move into the top bar. In a plain
browser the dots SHALL NOT be rendered.

#### Scenario: Minimize from the sidebar
- **WHEN** the user clicks the yellow dot in the desktop window
- **THEN** the window minimizes

#### Scenario: Drag window
- **WHEN** the user drags the empty area of the top bar
- **THEN** the window moves; clicking the Spotlight trigger does not move it

#### Scenario: No dots in a browser
- **WHEN** the UI is opened in a regular browser tab
- **THEN** no red, yellow or green window dots are shown

#### Scenario: Collapsed sidebar
- **WHEN** the user collapses the sidebar in the desktop window
- **THEN** the window dots are still visible and working, in the top bar

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

### Requirement: Status bar
The status bar SHALL show, on the left, how many torrents the active tab plus its lens match out of the library
total, and the engine name with its state; on the right, free space of the default download directory and the
terminal toggle with its shortcut. Total download and upload rate SHALL be shown at the foot of the sidebar, and
session ratio, server CPU % and memory SHALL be reachable from there. All of these SHALL refresh with the list.

#### Scenario: Free space
- **WHEN** the download directory's disk has 1.2 TB free
- **THEN** the status bar reads `free 1.2 TB`

#### Scenario: Match counts
- **WHEN** the active tab plus lens match 9 of 312 torrents
- **THEN** the status bar reads that 9 of 312 torrents match this tab and lens

#### Scenario: Session ratio still available
- **WHEN** the user opens the transfer totals at the foot of the sidebar
- **THEN** session ratio, CPU % and memory are shown

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

## ADDED Requirements

### Requirement: Browser shell
The UI SHALL be laid out as a left sidebar and a main area. The sidebar SHALL contain, top to bottom: window
controls (desktop only), the Spotlight trigger showing its shortcut, the tab list, "New tab" and "Save current
lens as tab", and the transfer totals. The main area SHALL contain a top bar (back, forward, the title of the
current view, a lens summary when a lens is applied, the terminal toggle and settings), the filter bar, the
torrent list and the status bar. The sidebar SHALL be collapsible and expandable, and the collapsed state SHALL
survive a reload. There SHALL be no horizontal tab strip and no search box in a header.

#### Scenario: Collapse the sidebar
- **WHEN** the user collapses the sidebar and reloads
- **THEN** the sidebar is still collapsed and the list uses the full width

#### Scenario: Lens summary
- **WHEN** the active tab has three lens predicates
- **THEN** the top bar shows, next to the tab title, that a three-filter lens is applied to this tab

### Requirement: Navigation history
Every view the user can reach — a tab, and later a torrent page or a settings section — SHALL have its own
address, so that the browser's or the top bar's back and forward move between them and reloading or opening the
address shows the same view. An address SHALL NOT carry a lens. An address that names a tab or torrent that no
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

### Requirement: Spotlight
The UI SHALL provide one Spotlight panel, opened by its shortcut or the sidebar trigger, centered over a dimmed
window with the caret in its input. It SHALL be the only global input: jump, filter, commands, tab creation and
adding all start there. What the input holds SHALL decide what is listed:
- plain text: a "Jump to" section ranking torrents and tabs by name, then an "Actions" section, then a pinned
  "All torrents" entry;
- a structured query: a strip showing how the input parses (as chips) with the number of matches out of the
  library total, then "Create tab from this query", then "Filter results" (matches across all torrents, with a
  "show all" entry), then "Jump to", then "Actions" applying to the matches;
- a leading `>`: "Actions" first.
Each section SHALL be labelled, sections SHALL never be merged, and a destructive action SHALL never be the
first row. Rows SHALL show their keybinding where one exists. Arrow keys SHALL move between rows, Enter SHALL
run the highlighted row, and Escape or a click outside SHALL dismiss the panel with nothing applied. A query
that does not parse SHALL show the parser's message under the input with a marker at the failing column.

#### Scenario: Jump by name
- **WHEN** the user opens Spotlight, types `ubuntu` and presses Enter on the first result
- **THEN** that torrent is opened and the active tab's lens is unchanged

#### Scenario: Structured query sections
- **WHEN** the user types `state:active tag:4k size:>4GB sort:ratio`
- **THEN** the panel shows the parsed chips with `41 of 312`, then Create tab, Filter results, Jump to and
  Actions as four labelled sections in that order

#### Scenario: Create a tab from Spotlight
- **WHEN** the user chooses "Save as smart tab" for that query and confirms the name
- **THEN** the tab appears in the sidebar and becomes the active tab

#### Scenario: Show all matches
- **WHEN** the user chooses "Show all 41 matches"
- **THEN** the pinned "All" tab becomes active with that query applied as its lens

#### Scenario: Parse error
- **WHEN** the user types `statu:active`
- **THEN** the panel shows the error under the input pointing at `statu` and suggests `state`

#### Scenario: Dismiss
- **WHEN** the user presses Escape
- **THEN** the panel closes and the tab, lens and sidebar are exactly as before it opened

### Requirement: Spotlight never filters on its own
Typing in Spotlight SHALL NOT change the list behind the panel, the active tab's lens or the sidebar. The lens
SHALL change only when the user explicitly picks a filter entry, uses the "filter instead" key on plain text, or
chooses "show all". A filter entry SHALL state its scope — the active tab by name, or all torrents — before it
is run.

#### Scenario: Plain text does not filter
- **WHEN** the user types `ubuntu` in Spotlight and then presses Escape
- **THEN** the list behind the panel never changed

#### Scenario: Filter instead
- **WHEN** the user types `ubuntu` and presses the "filter instead" key
- **THEN** the panel closes and the active tab gains a name-contains-`ubuntu` chip

#### Scenario: Scope is stated
- **WHEN** the user types `>` followed by `paus` and looks at the Filter section
- **THEN** one row offers `state:paused` as a lens in the named active tab and another offers it in All torrents

### Requirement: Commands are all in Spotlight
Every action the UI offers through a button, menu or shortcut SHALL also be listed in Spotlight's Actions, each
with its keybinding and its scope (selection, active tab or global). An action whose scope is the selection
SHALL be listed as unavailable, with the reason, when nothing is selected.

#### Scenario: Pause variants
- **WHEN** the user types `> pause` with one torrent selected
- **THEN** Actions lists pausing the selected torrent, pausing all in the active tab and pausing everything, each
  labelled with its scope and shortcut

#### Scenario: Nothing selected
- **WHEN** no torrent is selected
- **THEN** selection-scoped actions are shown disabled with "nothing selected"

### Requirement: Empty library state
When the library holds no torrents at all, the list area SHALL show an empty-library state that says the library
is empty and that this is not the result of a filter, a drop zone for `.torrent` files, the actions paste
magnet, add `.torrent` and open Spotlight with their shortcuts, and a short orientation on tabs, chips and the
terminal. This state SHALL be distinct from the zero-results state, SHALL NOT offer "clear lens", and SHALL be
replaced by the list as soon as a torrent exists.

#### Scenario: Fresh install
- **WHEN** the server reports no torrents
- **THEN** the list area shows the empty-library state and the status bar reads `0 torrents`

#### Scenario: Not a filter
- **WHEN** the library is empty
- **THEN** the state says so explicitly and offers adding, not clearing a lens

#### Scenario: First torrent
- **WHEN** the user drops a `.torrent` file on the drop zone and adds it
- **THEN** the empty state is replaced by the list containing that torrent

### Requirement: Keyboard map
Every surface SHALL be operable without a mouse. The UI SHALL provide at least: open Spotlight; open Spotlight in
command mode; jump to the nth sidebar tab; next and previous tab; new tab; save the lens as a tab; rename the
active tab; collapse the sidebar; focus the filter input; open the filter builder; clear the lens; undo the last
chip change; move the row cursor, extend the selection and select all rows the lens shows; open the selected
torrent; pause or resume the selection; remove with confirmation; add a tag to the selection; back and forward;
open settings. A shortcut sheet SHALL list every binding grouped by surface with its scope, and SHALL show the
bindings that work in the current environment (the platform's modifier keys, and the fallback where a browser
reserves the desktop binding). A shortcut SHALL NOT fire while the user is typing in a text field unless it uses
a modifier.

#### Scenario: Shortcut sheet
- **WHEN** the user opens the shortcut sheet
- **THEN** it lists the bindings by group — Spotlight, tabs, lens, list, navigation — each with its scope

#### Scenario: Platform modifiers
- **WHEN** the UI runs on Windows or Linux
- **THEN** the sheet and every keybinding hint show Ctrl and Alt rather than ⌘ and ⌥

#### Scenario: Keyboard-only add
- **WHEN** the user opens Spotlight by shortcut, pastes a magnet and presses the add-and-start shortcut
- **THEN** the torrent is added without any pointer interaction

#### Scenario: Typing is not hijacked
- **WHEN** the caret is in the filter input and the user presses Space
- **THEN** a space is typed and no torrent is paused
