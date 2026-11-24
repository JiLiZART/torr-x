## MODIFIED Requirements

### Requirement: Add torrent dialog
Adding a torrent SHALL happen inside the Spotlight panel, not in a separate dialog. When the Spotlight input
holds a magnet link or a `.torrent` URL, when a `.torrent` file is chosen with the panel's "Add .torrent" control,
or when a `.torrent` file is dropped anywhere on the window, the panel SHALL fetch a preview from the server and
grow downward with its top edge and input in place into the add flow: a header (name, size, file count, hash,
created date), sections Files, Trackers, Options and Advanced, a file list with checkboxes, per-file priority,
Select all / Select none / Invert and its own filter bar using the file-scoped query fields, the save path
(default from settings) with free space, and the options start immediately, create subfolder, priority and tags.
When the total size of the checked files exceeds the free bytes of the save path's volume, the flow SHALL show
a warning naming the needed size, the free bytes and the path, recomputed whenever the selection or path
changes; the warning SHALL NOT block adding, and SHALL NOT appear while a magnet's metadata (and thus its size)
is still unknown. "Add & start" SHALL add the torrent with only the selected files wanted; "Add paused" SHALL
add it paused; Cancel or Escape SHALL return the panel to its input-only state without adding. Options the
active engine does not support SHALL be disabled with the "not supported by <engine>" hint. Adding a torrent
SHALL NOT change the active tab or its lens. Adds made from the UI SHALL record `addedBy: "you"`. While the
preview is loading the panel SHALL show a loading line and SHALL NOT change height.

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

#### Scenario: It will not fit
- **WHEN** the checked files total 60 GB and the save path's volume has 21 GB free
- **THEN** the flow shows "needs 60 GB, 21 GB free on /data" next to the save path, and "Add & start" remains
  available

#### Scenario: Unchecking files clears the warning
- **WHEN** the user unchecks files until the selected total is under the free bytes
- **THEN** the warning disappears without any other change to the flow

## ADDED Requirements

### Requirement: Provenance in the list
The torrent list SHALL offer an "added by" column at the lowest adaptive-priority tier (hidden first at narrow
widths, header and cells together), with a distinct glyph for values other than `you`; the value SHALL also
appear in the detail hero. Spotlight SHALL offer an "Added by automation" jump that opens the current tab with
the lens `by:!you added:<24h`, without saving a tab.

#### Scenario: What the robots did overnight
- **WHEN** Sonarr added four episodes overnight and the user picks "Added by automation" in Spotlight
- **THEN** the list shows exactly those four torrents with `by:!you added:<24h` as removable chips

#### Scenario: Narrow window
- **WHEN** the window narrows past the first adaptive breakpoint
- **THEN** the "added by" column hides before seeds/peers, and the value remains visible in the detail hero
