## Why

Torrent details are a panel squeezed under the list: it hides the terminal, has no address, loses its place when
closed, and its Files, Peers and Trackers tables cannot be filtered or sorted at all — while the list above them
now has a full query language. The design (`pen/untitled.pen`, screens 09–12 and 15, board C "Torrent detail",
board H "Modal torrent details") makes the detail view a page with browser back, gives every section the same
filter bar as the list, and lets the Files section present a season of episodes as episodes instead of a flat
file tree.

## What Changes

- **Detail is a page, not a panel**: opening a torrent navigates to its own address inside the same shell
  (breadcrumb `← <tab> / <name>`). Back returns to the tab with its scroll position and lens exactly as left.
  The under-list details panel is removed. **BREAKING (UI)**: selecting a row no longer opens details — Enter or
  double-click does.
- **Status hero**: name, state, size, file count, tracker, added, hash, save path; Pause/Resume, Verify, Reveal,
  Remove; a segmented progress bar and a stat strip (progress, transferred, ETA, down, up, seeds, peers, ratio)
  with the live speed graph.
- **Sections**: Overview, Files, Peers, Trackers, Web seeds, Pieces — each with its count and its own address.
  The separate "Seeds" tab goes away (it is `sort:`/filter on Peers now).
- **A mini filter bar per section**, using the same query language with the section's own fields
  (`ext: priority: ep: season:`, `country: client: flags:`, `status:`), chips, a sort chip and a shown-of-total
  count. A section lens is scoped to that section and never saved.
- **Files in media mode**: when a torrent's video files parse as episodes, Files offers a media view — season
  picker, episode strip, one row per episode with quality tags, size, progress and state — switchable back to the
  plain list. Nothing is invented: titles and durations appear only if known.
- **Row actions follow the file format**: open, reveal in file manager and copy path for every file; "play"
  (open with the system player) for video. Priority and skip stay.
- **Trackers and web seeds** get the columns the design shows (tier, status, seeds, leechers, last/next announce,
  failure reason; web seed URL, status, speed, downloaded) where the engine reports them, plus re-announce and
  add web seed gated by capabilities.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: "Details panel" becomes a detail page; adds section filter bars, media mode and format-aware file
  actions.
- `http-api`: per-file open/reveal, re-announce, add web seed; tracker/peer/web-seed fields on the details model.
- `torrent-engine`: extended tracker, peer and web-seed detail in the engine-agnostic model.
- `engine-capabilities`: new feature keys `webSeeds`, `addWebSeed`, `reannounce`, `openFile`.

## Impact

- `packages/ui`: new `detail/` (`DetailPage`, `Hero`, `SectionTabs`, `FilesSection`, `MediaView`,
  `PeersSection`, `TrackersSection`, `WebSeedsSection`, `PiecesSection`, `OverviewSection`); `TorrentDetails.tsx`
  removed; `lib/media.ts` (episode/quality parsing) with `node --test`; `App.tsx` routes the `torrent` view.
- `packages/query`: evaluation against file, peer, tracker and web-seed rows (the fields are already in the
  registry).
- `crates/torrentx-core`: `Tracker` gains `tier`, `kind`, `leechers`, `downloaded`, `error`; `Peer` gains
  `encryption`; `TorrentDetails` gains `webSeeds`; drift fixture + `packages/api-client` updated together.
- `crates/torrentx-rqbit`, `crates/torrentx-transmission`: fill the new fields where available, `null` otherwise.
- `crates/torrentx-server/src/api.rs`: `POST /torrents/{id}/files/{index}/open`, `/reveal` with a file index,
  `POST /torrents/{id}/reannounce`, `POST /torrents/{id}/web-seeds`.
- i18n keys in all six dictionaries.
- Depends on `browser-shell-and-spotlight` (routes, top bar, tokens) and `query-language-and-smart-tabs`
  (`FilterBar`, parser).
