## Why

Finding one file today means guessing which torrent holds it, opening that torrent and filtering its Files
section. With hundreds of torrents (season packs, ISOs, sample folders) the question is usually "where is
`*.srt` for episode 4" or "which torrent has `ubuntu-24.04.iso`", not "show me torrent X". The palette is already
the one place to jump, filter and act, so file search belongs there.

## What Changes

- **File mode in the palette**: in `⌘T`, typing `@` as the first character and then Space turns the input into a
  file search across all torrents. The `@` becomes a mode chip (like the `>` command mode). Backspace on an empty
  input leaves file mode.
- **Torrent scope picker**: in file mode, typing `torrent:` followed by Space switches to choosing a torrent by
  name. Picking one adds a `torrent:<name>` scope chip and returns to file search within that torrent only.
  Backspace on an empty input removes the scope chip first.
- **Already in a torrent**: when the palette opens on a torrent's detail page, entering file mode pre-adds that
  torrent's scope chip. The user can remove it with Backspace to search everywhere.
- **File query**: text after the chips is a file query in the existing file scope (`name`, `path`, `ext`, `size`,
  `done`, `priority`, `ep`, `season`) plus a new `torrent` field (torrent name). Plain words match file names.
  Typing `torrent:ubuntu` without the trailing Space is just a predicate, not the picker.
- **Compact file rows**: results use the Files section's row in compact form: format icon, file name, torrent
  name (only when not scoped), size, done bar and percent, and priority word. Long file and torrent names are
  trimmed in the middle, keeping the start and the extension, with the full path in the tooltip.
- **Open a result**: `⏎` opens the torrent's Files section with that file scrolled into view and highlighted.
- **Server**: new `GET /api/v1/files` returning every torrent's files in one flat, compact list, so the palette
  needs one request instead of one per torrent. The server filters nothing (queries are evaluated in the UI, as
  for torrents).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: palette file mode, torrent scope picker, compact file rows, opening a file result in the Files
  section.
- `http-api`: `GET /api/v1/files`.
- `torrent-query`: file-search scope = file scope plus `torrent`.

## Impact

- **Server**: one new route in `crates/torrentx-server/src/api.rs`. A new engine method lists all torrents' files
  in one call (rqbit: in-process session; Transmission: one `torrent-get` with file fields). Model:
  `FileHit {torrentId, torrentName, index, path, size, progress, wanted, priority}` in `torrentx-core`, mirrored
  in `packages/api-client`.
- **Query**: `packages/query` gains a file-search scope (`FILE_SCOPE` fields + `torrent`).
- **UI**: `Palette.tsx` (mode chips, file and torrent-picker modes), `lib/palette.ts` (mode detection, pure and
  tested), a compact variant of the file row shared with `detail/FilesSection.tsx`, a middle-trim helper, a
  highlight target on the detail route, and i18n keys in six dictionaries.
- **Depends on** `torrent-detail-screen` (Files section and its row) and `active-tab-screen` (`torrent-query`
  spec). Compatible with `multi-provider-engines`: hits carry the torrent id, scoped or not.
- **Non-goals**: content search inside files; file actions (play, reveal, priority) from palette rows; a server
  file index or background crawling; fuzzy ranking beyond the palette's existing prefix/word/substring score.
