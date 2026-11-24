## ADDED Requirements

### Requirement: Empty library state
When the library holds no torrents at all, the list area SHALL show an empty-library state: an inbox mark,
the headline "No torrents yet", the sentence "The library is empty — this is not a filter. Add a magnet link
or a .torrent file and it lands in the All tab.", a drop zone for `.torrent` files that also accepts pasted
magnets, the actions Paste magnet (⌘V), Add .torrent (⌘O) and Open Spotlight (⌘T), and three orientation
cards — tabs are saved queries, chips are the lens, the terminal speaks the same language (with its shortcut
and an example query). While this state shows, the top bar caption SHALL read "no lens · nothing to filter
yet", the filter input placeholder SHALL be "Filter by name…", and the status bar SHALL read
`0 torrents · engine <name> · idle`. The state SHALL be distinct from the zero-results state, SHALL NOT offer
"clear lens", and SHALL be replaced by the list as soon as a torrent exists.

#### Scenario: Fresh install
- **WHEN** the server reports no torrents
- **THEN** the list area shows the empty-library state and the status bar reads `0 torrents · engine rqbit ·
  idle`

#### Scenario: Not a filter
- **WHEN** the library is empty
- **THEN** the state says so explicitly and offers adding, not clearing a lens

#### Scenario: First torrent
- **WHEN** the user drops a `.torrent` file on the drop zone and adds it
- **THEN** the empty state is replaced by the list containing that torrent

### Requirement: First-run setup
On a server whose configuration was never confirmed, the UI SHALL open a three-step setup wizard — Engine,
Library, Access — with a step rail marking completed steps, Back and Continue (⏎), and a one-click
"Skip — use defaults". Step Library SHALL offer the download folder (validated writable, with live free
space and a Browse action), move-completed downloads (noting TorrentX handles it when the engine cannot), and
a checkbox list of starting tabs shown as saved queries with pin badges and their query text. Step Access
SHALL default to loopback-only without a password and SHALL require a password before allowing network
exposure. The wizard SHALL state that nothing is downloaded during setup and that every choice is editable
later in Settings. Completing or skipping SHALL call the setup endpoint exactly once; existing installations
SHALL never see the wizard.

#### Scenario: Skip with defaults
- **WHEN** the user clicks "Skip — use defaults" on step 1
- **THEN** setup completes with current defaults, the wizard closes and the empty-library state shows

#### Scenario: Unwritable folder
- **WHEN** the chosen download folder is not writable
- **THEN** the row shows "must be writable" in red and Continue is blocked until it passes

#### Scenario: Starting tabs are queries
- **WHEN** step 2 lists the starting tabs
- **THEN** each row shows its name, pin badge where pinned, and its query text in monospace, and unchecking
  a tab removes it from the resulting tab set

#### Scenario: Existing install
- **WHEN** a configuration written by an earlier version loads
- **THEN** the wizard never renders

#### Scenario: Nothing downloaded
- **WHEN** setup completes with any choices
- **THEN** the library still holds zero torrents
