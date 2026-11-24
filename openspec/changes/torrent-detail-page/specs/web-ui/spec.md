## MODIFIED Requirements

### Requirement: Details panel
Opening a torrent (Enter or double-click on its row, a Spotlight jump, or its address) SHALL show a detail page
in the main area of the same window — not a dialog and not a panel under the list — with a breadcrumb naming the
tab it was opened from. Going back SHALL return to that tab with the same scroll position and the same lens.
The page SHALL have:
- a hero: name, state, size, file count, primary tracker, added date, info-hash, save path; the actions pause or
  resume, verify, reveal and remove; a progress bar reflecting which parts of the torrent are present; progress,
  transferred of total, ETA, download rate, upload rate, connected and known seeds, connected and known peers,
  and ratio; and the live speed graph (hidden when "show speed graph" is off);
- sections, each with its own address and a count where it lists things: Overview (the remaining facts — pieces
  × piece size, availability, wasted, creator, comment, created date, downloaded, uploaded), Files, Peers,
  Trackers, Web seeds and Pieces (the piece map; hidden when "show piece visualization" is off).
Files SHALL show per file its name, size, progress and priority, with High / Normal / Low priority and Skip.
Peers SHALL show address, country, client, progress, download and upload rate, flags with a legend, and
encryption. Trackers SHALL show URL, tier, status, seeds, leechers, last and next announce and, for a failing
tracker, the reason, and SHALL offer "Add tracker". Web seeds SHALL show URL, status, speed, downloaded and, for
a failing seed, the reason. Values the engine does not report SHALL be shown as unknown, never invented, and
actions the engine does not support SHALL be disabled with the "not supported by <engine>" hint. The page SHALL
refresh while open; a section that fails to load SHALL show its own error while the hero and other sections keep
working.

#### Scenario: Open and go back
- **WHEN** the user scrolls the "Active" tab with a two-chip lens, opens a torrent and goes back
- **THEN** "Active" is shown at the same scroll position with the same two chips

#### Scenario: Section address
- **WHEN** the user opens the Peers section and reloads the page
- **THEN** the same torrent's Peers section is shown

#### Scenario: Skip file
- **WHEN** the user chooses "Skip" on one file of a multi-file torrent
- **THEN** the file is marked skipped, stops downloading, and the torrent's remaining size shrinks

#### Scenario: Add tracker
- **WHEN** the user adds `udp://tracker.example:1337/announce` under an engine that supports it
- **THEN** the tracker appears in the Trackers section

#### Scenario: Failing tracker
- **WHEN** a tracker's last announce failed with "torrent not registered"
- **THEN** its row shows status "not working" and that reason

#### Scenario: Web seeds unsupported
- **WHEN** the active engine does not report web seeds
- **THEN** the Web seeds section says it is not supported by that engine instead of showing an empty table

#### Scenario: Section error is contained
- **WHEN** the peers request fails while the page is open
- **THEN** the Peers section shows the error and the hero and Files section keep updating

## ADDED Requirements

### Requirement: Detail section filters
The Files, Peers, Trackers and Web seeds sections SHALL each have a filter bar that behaves like the list's — a
name input, chips for every applied predicate including the sort chip, removal and negation in place — using the
same query language with that section's fields: `name`, `ext`, `size`, `progress`, `priority`, `ep`, `season`
for files; `country`, `client`, `flags`, `progress`, `down`, `up` for peers; `status`, `tier`, `seeds` for
trackers; `status` for web seeds. Each section SHALL show how many rows are shown out of the total. A section's
filter SHALL affect only that section of that torrent, SHALL NOT be saved or offered as a tab, and SHALL be
dropped when the user leaves the torrent. A field that does not belong to the section SHALL be reported as an
error naming the section. A filter that the page applies by default SHALL be shown as removable chips.

#### Scenario: Filter peers
- **WHEN** the user enters `country:!CN flags:!snubbed sort:down desc` in Peers
- **THEN** matching peers are listed fastest first, three chips are shown, and the count reads how many of the
  total are shown

#### Scenario: Scoped to the section
- **WHEN** the user filters Files and switches to Trackers
- **THEN** Trackers lists all its rows and shows only its own chips

#### Scenario: Wrong field
- **WHEN** the user enters `tag:4k` in the Files filter
- **THEN** an error states that `tag` is not a file field

#### Scenario: Default filter is visible
- **WHEN** Files opens on a torrent with skipped files and hides them by default
- **THEN** a `priority:!skip` chip is shown and removing it lists the skipped files

#### Scenario: No rows after filtering
- **WHEN** a section filter matches nothing
- **THEN** the section names the predicate responsible and offers to clear the filter

### Requirement: Media mode for files
When at least two video files of a torrent can be read as season and episode from their names, the Files section
SHALL offer a media view and use it by default, with a control to switch between media view and list view. The
media view SHALL show a season picker, a strip of the episode numbers of the chosen season, and one row per
episode with its season and episode code, the title when the file name contains one, quality tags read from the
name (resolution, HDR, audio), size, progress and state (ready, downloading, queued, skipped). Episodes hidden by
the section filter SHALL remain in the strip, marked as hidden. `ep:` and `season:` SHALL filter and sort on the
parsed numbers. Information not present in the file names or the model SHALL NOT be shown.

#### Scenario: Season pack
- **WHEN** the user opens a torrent holding `Show.S02E01…E09` video files
- **THEN** Files opens in media view with season S02 selected and nine episode rows

#### Scenario: Filter by episode
- **WHEN** the user enters `ep:>3`
- **THEN** episodes 4 to 9 are listed and 1 to 3 are marked as hidden in the strip

#### Scenario: Switch to list view
- **WHEN** the user switches to list view
- **THEN** every file, including subtitles and samples, is listed as in any other torrent

#### Scenario: Not a series
- **WHEN** a torrent holds one video file and a subtitle
- **THEN** no media view is offered

### Requirement: File row actions
Each file row SHALL offer open, reveal in the file manager and copy path, in addition to priority and skip. For a
video file "open" SHALL be labelled as play. Open and play SHALL be available only for a completely downloaded
file. Open, play and reveal act on the machine running TorrentX: when the UI is not on that machine they SHALL be
disabled with a hint saying so, while copy path SHALL always work.

#### Scenario: Play a finished episode
- **WHEN** the user chooses play on a fully downloaded video file in the desktop app
- **THEN** the file opens in the system's default player

#### Scenario: Incomplete file
- **WHEN** a file is at 62%
- **THEN** its play or open action is disabled and says the file is not complete

#### Scenario: Remote browser
- **WHEN** the UI is opened from another computer
- **THEN** open, play and reveal are disabled with the hint that they work only on the machine running TorrentX,
  and copy path copies the file's path
