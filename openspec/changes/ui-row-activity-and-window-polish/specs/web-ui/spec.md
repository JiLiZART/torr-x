## MODIFIED Requirements

### Requirement: Window controls
Inside the desktop window, the header's red, yellow and green dots SHALL close (hide to tray), minimize and toggle maximize the window, the header background SHALL drag the window, and double-clicking it SHALL toggle maximize; interactive header elements (search, buttons) SHALL NOT start a drag. In a plain browser the dots SHALL NOT be rendered and the header SHALL start directly with the TorrentX title.

#### Scenario: Minimize from header
- **WHEN** the user clicks the yellow dot in the desktop window
- **THEN** the window minimizes

#### Scenario: Drag window
- **WHEN** the user drags the header's empty area
- **THEN** the window moves; typing in the search box does not move it

#### Scenario: No dots in a browser
- **WHEN** the UI is opened in a regular browser tab
- **THEN** no red, yellow or green window dots are shown in the header

## ADDED Requirements

### Requirement: Stable torrent row layout
Every torrent row SHALL have the same fixed height, independent of the torrent name length, the window width and the live values shown. Numeric cells (size, progress percentage, seeds, peers, download and upload speed, ETA) SHALL each stay on a single line, with the number and its unit never separated by a line break, and SHALL keep their width as values update. A long name SHALL be clamped to at most two lines, ending in an ellipsis, with the full name available as a tooltip.

#### Scenario: Speed changes unit
- **WHEN** a torrent's download speed changes from "999.0 KB/s" to "1.0 MB/s" between refreshes
- **THEN** the row height and the positions of the other columns do not change

#### Scenario: Very long name
- **WHEN** a torrent's name is longer than two lines of the name column
- **THEN** the row shows the first two lines ending in "…", keeps the standard row height, and hovering shows the full name

#### Scenario: Narrow window
- **WHEN** the window is resized to its minimum width
- **THEN** no size or speed value wraps onto a second line and all rows keep the same height

### Requirement: Adaptive list columns
The torrent list SHALL hide lower-priority columns as the available width shrinks instead of compressing the remaining ones: seeds and peers are hidden first, then size and ETA. Name, progress, download and upload speed SHALL always be shown. The header and the rows SHALL always show the same set of columns, aligned.

#### Scenario: Medium width
- **WHEN** the list is narrower than the width needed for all columns
- **THEN** the seeds and peers columns disappear from both the header and every row

#### Scenario: Wide window
- **WHEN** the window is wide enough for all columns
- **THEN** all eight columns are shown

### Requirement: Row activity graph
A torrent row whose status is downloading or seeding SHALL show, behind its content, a faint graph of its recent activity covering about the last 90 seconds: download speed as a filled area, upload speed as a line, and disk write rate (payload bytes completed per second) as a separate line. Each row's graph SHALL be scaled to that row's own peak over the shown window. The graph SHALL NOT make row text or controls harder to read or click, SHALL use theme colors, and SHALL NOT be shown for paused, checking, queued or errored torrents. History SHALL be collected by the UI from the regular list refresh; it starts empty when the page loads and needs no new API.

#### Scenario: Active download
- **WHEN** a torrent has been downloading for a few refreshes
- **THEN** its row shows a background graph whose right edge reflects the latest download, upload and disk rates

#### Scenario: Paused torrent
- **WHEN** the user pauses a downloading torrent
- **THEN** its row no longer shows the activity graph

#### Scenario: Readable content
- **WHEN** a row shows the activity graph
- **THEN** the name, values and hover action buttons remain readable and clickable on top of it
