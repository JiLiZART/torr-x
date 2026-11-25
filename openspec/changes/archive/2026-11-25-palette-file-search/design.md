## Context

- `Palette.tsx` keeps `command` (the `>` mode, entered by typing `>` into an empty input) and `text`;
  `lib/palette.ts` `detectMode()` picks command / jump / query and `rank()` scores names (prefix, word prefix,
  substring). The palette only has the torrent list (`all`), not files.
- Files exist only per torrent: `GET /torrents/{id}` → `TorrentDetails.files`. `detail/FilesSection.tsx` turns
  them into `FileRow` (`lib/detail.ts` `fileRow`) and filters with `FILE_SCOPE` from `@torrentx/query`.
- The server never parses query text; queries are evaluated in the UI.
- Detail addresses are `#/torrent/<id>/<section>` (`lib/route.ts`) and never carry a lens.

## Goals / Non-Goals

**Goals:**
- One request for the files of all torrents, evaluated with the same query package.
- Mode switching is pure and tested; the palette component only renders it.
- Reuse the Files row instead of drawing a second file row.

**Non-Goals:**
- A server-side file index, incremental updates or polling while the palette is open.
- File actions from palette rows.

## Decisions

### Palette state is a chip stack plus text
Replace the `command` boolean with `chips: Chip[]` where `Chip = {kind: "command"} | {kind: "files"} |
{kind: "torrentPending"} | {kind: "torrent", id, name}`. Pure transitions in `lib/palette.ts`:
- `onInput(chips, prev, next)`: `""` → `">"` pushes `command` (unchanged behavior); `""` → `"@ "` pushes
  `files`; in files mode, text ending in `torrent: ` (token at a word boundary) pushes `torrentPending` and
  strips the token from the text.
- `onBackspaceEmpty(chips)`: pops the last chip.
- `pickTorrent(chips, torrent)`: replaces `torrentPending` with `torrent`.
- `openPalette({detailTorrent})`: entering files on a detail page also pushes that torrent's chip.

`detectMode()` gains `files` and `pickTorrent` kinds derived from the top chip. Unit tests cover every
transition, including `foo @` staying text and `torrent:ubuntu` (no Space) staying a predicate.
- *Alternative*: keep `@`/`torrent:` as literal text and re-parse every keystroke — the chips would vanish when
  the caret moves and Backspace semantics get fragile.

### Torrent chip bound by id, displayed by name
The scope chip stores the torrent id and filters hits by `torrentId`, not by name, so two torrents with the same
name never mix. The chip shows the middle-trimmed name. Typed `torrent:<text>` stays a name predicate, by design.

### `GET /files` built from one engine call
New inherent engine method `files_all() -> Vec<(String /* id */, Vec<FileInfo>)>`:
- rqbit: iterate the session's managed torrents with metadata, as `get()` does per torrent.
- Transmission: one `torrent-get` with `fields: ["hashString", "files", "fileStats"]` for all torrents.
The server joins names from `list()` (decorated, so rename overrides apply) and flattens to `FileHit`. No
caching: the palette fetches once when file mode is entered and refetches only when reopened.
- *Alternative*: the UI calls `GET /torrents/{id}` for each torrent — N requests per palette open, and N
  Transmission RPCs.
- *Alternative*: a server query parameter — breaks the "server never parses queries" rule.

Size: about 120 bytes per file; 300 torrents × 50 files ≈ 1.8 MB uncompressed, fetched once per open. Recorded as
a known ceiling next to "no list virtualization".

### File-search scope in `@torrentx/query`
`FILE_SEARCH_SCOPE = {...FILE_SCOPE, fields: {...FILE_SCOPE.fields, torrent: "text"}}` with a `read` that
resolves `torrent` from the hit. Palette hits are `FileRow & {torrentId, torrentName}`, built with the existing
`fileRow()`, so `ep`/`season`/`ext` behave exactly as in the Files section.

### Ranking and limit
Filter with `evaluate(ast, row)`, then `rank()` on the file name with the bare words of the query (empty words =
keep order), then cap at 50. Scoped and empty query: the torrent's file order, capped the same way.

### Compact row shared with the Files section
Extract the Files section's row cells into `FileRowCells` with a `compact` prop: compact hides actions and the
checkbox, uses single-line cells and adds the optional torrent-name cell. `FilesSection` keeps using the full
variant, so the two can't drift.

### Middle trim
`trimMiddle(name, max)` in `lib/format.ts`: if `name.length <= max` return it; else keep the tail = extension
plus an `SxxEyy` code if it is within the last 24 characters, and fill the head up to `max - 1 - tail.length`,
joined by `…`. Character-based (monospace font, fixed column widths: name 44 chars, torrent 24 chars in compact
rows). Tested with long scene names, names without extension, and names shorter than the limit.
- *Alternative*: CSS `text-overflow: ellipsis` — trims only the end, losing the extension the user is looking for.

### Opening a result
`⏎` navigates to `#/torrent/<id>/files` and sets an in-memory `focusFile = {torrentId, index}` in `App.tsx`;
`FilesSection` scrolls that row into view, highlights it for 2 s and clears `focusFile`. The address stays
lens- and highlight-free, so back/forward and reload behave as today.

## Risks / Trade-offs

- [Large libraries make `GET /files` heavy] → fetched only on entering file mode; ceiling documented; add
  server-side paging or an index if libraries in the thousands show up.
- [Space after `@` / `torrent:` is easy to miss] → the placeholder and the palette hint line show `@ ␣ files` and
  `torrent: ␣ pick a torrent`; the shortcut sheet lists both.
- [Files of a remote Transmission daemon with thousands of files make the one RPC slow] → the palette shows its
  loading line, then the results; the main list is unaffected.

## Open Questions

- Exact icon per format reuses the Files section's mapping; whether archives and disc images get distinct glyphs
  in compact rows can follow the canvas once the screen is drawn.
