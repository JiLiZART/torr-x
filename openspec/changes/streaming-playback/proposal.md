## Why

THE DAY stop 05 ("movie night, 40% downloaded") and VERDICT finding 03: librqbit streams any file of a torrent
while it downloads, and no client puts a play button where the progress bar is (STRUCTURE move 3,
REQUIREMENTS R6, UC6). The first cut (commit `f905b64`) added Play that opens an external player on a
short-lived stream link. A half-downloaded episode still cannot start from the hero, nothing says when an
unfinished file has enough data to start, and a file a browser can play still leaves the app.

## What Changes

- **Stream links (shipped, recorded here)**: `POST /torrents/{id}/files/{index}/stream` issues
  `/api/v1/stream/<token>/<name>`. The token is in memory, slides over 6 h and is cleared with sessions. It is
  the only credential, so external players need no login. The public route serves HTTP ranges straight from
  librqbit's `FileStream`. Transmission returns `unsupported` (501). Capability key `stream` (rqbit
  `via: engine`).
- **Play (shipped, recorded here)**: `POST …/files/{index}/play` (loopback only) opens a finished file from
  disk, or opens the stream link in `preferences.player` (else the first of IINA, VLC or mpv found). From
  another device, Play copies the link.
- **Built-in player (new)**: files a browser can decode (mp4, m4v, webm, mov) play in an overlay with
  `<video controls autoplay>` on the stream link. Seeking uses ranges and Escape closes it. A decode error is
  shown as is, with "Copy stream link" and, on the machine itself, "Open in video player". MKV and other
  containers keep the external player.
- **Start check (new)**: an unfinished file can start once its head is in: 2% of the file or 8 MiB,
  whichever is larger. Before that, Play is disabled and says how much more is needed.
- **Play on the progress (new)**: the hero's progress block gets a Play button for the largest video file
  ("Ready to play" for an unfinished file that can start). Episode rows and file actions use the same flow.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `engine-capabilities`: feature key `stream`.
- `torrent-engine`: engines expose a seekable per-file byte stream where they have one.
- `http-api`: stream link, public stream route, play endpoint.
- `web-ui`: Play on the hero, episode rows and file actions; built-in player; start check; copy link.

## Impact

- Server and engines: shipped in `f905b64`, with no changes here.
- `packages/ui`: `lib/media.ts` `headNeed` and `INLINE_EXT`; `lib/detail.ts` `fileActionBlock` returns
  `notReady`; `detail/usePlayback.tsx` (shared Play flow); `detail/Player.tsx` (overlay); `Hero`,
  `FilesSection` and `DetailPage` wired to it; i18n keys in six dictionaries.
- No desktop-crate changes. DLNA/UPnP is a non-goal.
