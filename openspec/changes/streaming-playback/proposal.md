## Why

THE DAY stop 05 ("movie night, 40% downloaded") and VERDICT finding 03: rqbit makes sequential download the
only mode and serves seekable HTTP streaming — the capability is already in our engine, and no client puts a
play button where the progress bar is (STRUCTURE move 3, REQUIREMENTS R6, UC6). Today TorrentX exposes none
of it: the detail page can open a completed file with the system player, but a half-downloaded episode has no
play affordance anywhere.

## What Changes

- **Stream endpoint**: `GET /torrents/{id}/files/{index}/stream` serves the file's bytes with HTTP Range
  support, proxied by the server from the engine's seekable stream (rqbit) behind the same auth and guards.
  Engines without streaming return `unsupported` (501); the capability matrix gains `streaming`
  (rqbit: `via: engine`; Transmission: unsupported).
- **Play where the progress is**: a play button on the detail hero's progress bar and on media-mode episode
  rows, enabled for video files once enough of the file's head is downloaded to start. Playing opens an
  inline player overlay (HTML5 `<video>` pointed at the stream endpoint) — identical in the browser and the
  desktop window, no Tauri IPC, seeking works through Range requests.
- **Honest gating**: on Transmission the play affordance is visible but disabled with "not supported by
  Transmission"; for non-video files there is no play button (open/reveal/copy-path stay as defined by
  `torrent-detail-page`). A "Copy stream URL" action accompanies the player for external players, with the
  auth caveat stated when auth is on.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `engine-capabilities`: new feature key `streaming`.
- `torrent-engine`: engines expose a seekable per-file stream where they have one; `Unsupported` otherwise.
- `http-api`: the stream endpoint (Range, auth, 501).
- `web-ui`: play affordance on the progress bar and episode rows, inline player, copy stream URL.

## Impact

- `crates/torrentx-server`: `api.rs` stream route proxying Range requests to the rqbit HTTP stream (reqwest,
  already a dependency); capability matrix entry; no new model fields — playability is derived from file
  extension + capability + downloaded head.
- `crates/torrentx-rqbit`: expose the engine's per-file stream URL builder; `crates/torrentx-transmission`:
  `Unsupported`.
- `packages/api-client`: `streamUrl(id, index)` helper (URL builder, not a fetch); capability type.
- `packages/ui`: `Player` overlay component, play button in `detail/Hero` and `MediaView` rows, copy action;
  i18n keys in six dictionaries.
- Depends on `torrent-detail-page` (hero, media mode, file actions) and `adopt-magic-patterns-ui`
  (capability matrix). No desktop-crate changes; no DLNA/UPnP surfacing (non-goal).
