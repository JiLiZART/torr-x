## ADDED Requirements

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
