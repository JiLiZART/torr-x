## Why

Two gaps from THE DAY: stop 04 ("the pool is nearly full again" — no client refuses an add it cannot fit, or
shows free space at the moment of choosing; UC5) and stop 02 ("the robots already added four things" — the
client shows torrents, never who asked for them; R7, UC2). With a Prowlarr → Sonarr/Radarr chain, most
torrents are not added by the human, and the only breadcrumb today is a category name. STRUCTURE moves 2 and
4: make the adder a column, and decide disk before the download, not after.

## What Changes

- **Add preflight**: a `GET /fs/free?path=` endpoint reports free/total bytes for the volume of a save path
  (resolved to the nearest existing ancestor). The Spotlight add flow already shows free space next to the
  save path (`add-flow-and-theming`); this change makes it *judge*: when the selected files' total size
  exceeds free bytes, the flow shows a warning naming the shortfall ("needs 60 GB, 21 GB free on /data") and
  recomputes as files are checked/unchecked or the path changes. The warning never blocks the add — the user
  may know space will be freed — but the add can no longer silently fail at 94% (the `disk-low` attention
  diagnosis from `attention-first-list` covers it afterwards).
- **Add provenance**: `AddOptions` gains `addedBy` (a short label); the server stores it and returns
  `Torrent.addedBy`. The TorrentX UI sends `you`; API clients (Sonarr, Radarr, scripts) pass their own name,
  and an unnamed API add is recorded as `api` — never attributed to the human. Existing torrents get `null`
  ("unknown"), never invented.
- **Provenance in the list**: an "added by" column (adaptive, hidden at narrow widths like other
  low-priority columns), the query field `by:` (`by:sonarr`, `by:!you` = everything the robots added), and a
  "since you were away" answer: the Spotlight/palette entry "Added by automation" jumps to `by:!you added:<24h`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `http-api`: free-space endpoint; `AddOptions.addedBy`; `Torrent.addedBy`.
- `torrent-query`: new field `by:`.
- `web-ui`: fit warning in the add flow (extends the `add-flow-and-theming` "Add torrent
  dialog" requirement), provenance column and jump.

## Impact

- `crates/torrentx-server`: `api.rs` `GET /fs/free` (path validated like the settings path check from
  `empty-library-and-first-run`); add route records `addedBy` (UI requests are identified by the explicit
  label, not by User-Agent); `store.rs` provenance map persisted in `state.json`.
- `crates/torrentx-core`: `Torrent.added_by: Option<String>`, `AddOptions.added_by`; drift fixture +
  `packages/api-client` updated together. Engines leave it `null`; the server fills it (same pattern as tags).
- `packages/query`: `by` field; `packages/ui`: add-flow warning line, provenance column + chip, palette jump
  entry; i18n keys in six dictionaries.
- Depends on `add-flow-and-theming` (add flow), `active-tab-screen` (query, tags pattern)
  and `ui-row-activity-and-window-polish` (adaptive columns). No engine changes; watch-folder attribution is
  a non-goal until the server has a watch folder (rqbit's own watch folder adds arrive as `api`).
