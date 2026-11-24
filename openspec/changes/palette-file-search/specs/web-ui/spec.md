## ADDED Requirements

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
