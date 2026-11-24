## MODIFIED Requirements

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
