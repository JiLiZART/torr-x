## Context

- `TorrentDetails.tsx` (512 lines) renders General / Trackers / Peers / Seeds / Files under the list, polling
  `GET /torrents/{id}`, `/peers` and `/pieces`. Opening it hides the terminal; closing it forgets the tab.
- The model already carries most of what the design shows: `TorrentDetails {pieceSize, pieces, availability,
  wasted, createdBy, comment, createdAt, trackers[], files[]}`, `Tracker {url, status, lastAnnounce,
  nextAnnounce, seeds, peers}`, `Peer {address, client, country, progress, downloadRate, uploadRate, flags,
  isSeed}`. Missing: tracker tier / failure reason / DHT-PeX pseudo rows, peer encryption, web seeds.
- `browser-shell-and-spotlight` provides hash routes with a reserved `torrent` view, the top bar with
  back/forward and the token set. `query-language-and-smart-tabs` provides `FilterBar`, chips and a field
  registry that already lists the section-scoped fields.
- `POST /torrents/{id}/reveal` exists and is loopback-only.
- Source frames: 09–12, 15; board C; boards G/H rules on detail.

## Goals / Non-Goals

**Goals:** a routed detail page; section-scoped lenses with the shared parser; media mode derived from file
names; honest tracker / peer / web-seed columns; format-aware file actions that work today.

**Non-Goals:** in-browser playback or streaming of partial files, casting, "add to library", mounting ISOs,
listing archive contents (none has a backend — they are not rendered rather than rendered dead); fetching
episode titles or durations from the internet; removing or editing trackers; a peer ban list; virtualized
tables.

## Decisions

1. **Route and return.** `#/torrent/<id>/<section>` (section defaults to `files` for multi-file torrents,
   `overview` otherwise). The list view is kept mounted but hidden while the detail page is shown, so back
   restores scroll and the lens for free and no "restore lens" prompt appears — it is not a tab switch. A
   torrent id that no longer exists falls back per the shell's stale-address rule.
2. **Polling per section.** The hero polls details at the list cadence; `/peers` and `/pieces` are polled only
   while their section is visible. A failing section request shows a section-scoped error and leaves the hero
   and the other sections working.
3. **Section lens = the list's `FilterBar` in `mini` mode with a `scope`.** `@torrentx/query` gets
   `evaluateRow(ast, row, scope)` for `file | peer | tracker | webseed`, where a scope declares its fields and
   how to read them from the row. A field outside the scope is a parse error ("`tag` is not a file field").
   Section lenses live in the detail page's React state keyed by section, are dropped when leaving the torrent,
   and never offer "Save as tab" (tabs hold torrent queries only).
4. **Default lenses are visible, not hidden.** Files opens with `priority:!skip sort:size desc` only when the
   torrent has skipped files, and shows it as chips the user can remove — a pre-applied filter is acceptable
   only because it is on screen with a shown-of-total count.
5. **Media mode is a pure function of file paths.** `lib/media.ts` parses `S01E04`, `1x04`, `Season 1/…`,
   resolution (`2160p`, `1080p`), HDR (`DV`, `HDR10`), audio (`DDP5.1`, `Atmos`) from names. Media view is
   offered when at least two video files yield a season+episode; it is the default view in that case and the
   choice (media | list) is remembered per torrent for the session. `ep:` and `season:` evaluate against the
   parsed values. Episode titles come from the file name only if a title segment follows the episode token;
   duration is not shown (no source). *Alt:* ask the server to probe files with ffprobe — rejected, a new
   runtime dependency for decoration.
6. **File actions through the server, loopback only.** `POST /torrents/{id}/files/{index}/open` opens the file
   with the OS default application on the machine running the server and, like `reveal`, is refused with 403
   for non-loopback peers; `reveal` accepts an optional `fileIndex`. "Play" is `open` on a video file and is
   enabled only when the file is complete (partial playback needs sequential download guarantees the engines do
   not give uniformly). In a remote browser these actions are disabled with "only on the machine running
   TorrentX"; copy path always works. Exposed as capability `openFile` (`via: server`).
7. **Model additions are nullable, engines fill what they know.** `Tracker.tier`, `.leechers`, `.downloaded`,
   `.error`, `.kind` (`tracker | dht | pex | lsd`), `Peer.encryption`, `TorrentDetails.webSeeds:
   [{url, status, downloadRate, downloaded, error}] | null`. Transmission supplies tiers, announce results and
   web seeds; rqbit supplies what its stats expose and `null` for the rest. `webSeeds: null` + capability
   `webSeeds: unsupported` renders the section as "not supported by <engine>", an empty array renders "no web
   seeds". Re-announce and add-web-seed are capabilities; unsupported → control disabled with the hint, API 501.
8. **Hero progress bar reuses the pieces bitfield** bucketed to the bar's width (the existing piece-map
   bucketing), falling back to a plain bar when `/pieces` is unsupported or `showPieceMap` is off. The Pieces
   section shows the full map plus piece size, count, availability and wasted.
9. **"Seeds" tab is dropped.** It was Peers filtered to progress 1; the Peers section's lens expresses it and
   the hero already shows seed counts.

## Risks / Trade-offs

- **Selecting a row no longer shows details.** → Enter and double-click open the page; the row's hover actions
  keep pause/remove one click away; the change file calls it out.
- **Episode parsing false positives** (e.g. `x264` read as `2x64`). → Require a separator around the token and
  a video extension; unit-test against a fixture list of real-world names; the list view is one click away.
- **Engines disagree on tracker status vocabulary.** → Normalize to `working | updating | not working |
  disabled | unknown` in the engine crates; the raw message goes to `error`.
- **Keeping the list mounted doubles polling work.** → The list poll continues (it feeds the sidebar counts
  anyway); only rendering is skipped while hidden.

## Migration Plan

1. Model + API additions (additive, nullable) with fixture and client types.
2. Detail page behind the `torrent` route; old panel still reachable.
3. Section lenses and media view.
4. Remove `TorrentDetails.tsx` and row-selection-opens-details. Rollback = revert; no stored data changes.

## Open Questions

- Should Overview keep the availability and wasted figures when both engines report `null`? Assumed: rows with
  `null` are hidden rather than shown as "—", except where the capability hint explains the gap.
