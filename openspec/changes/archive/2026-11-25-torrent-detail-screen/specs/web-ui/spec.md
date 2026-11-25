## ADDED Requirements

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
