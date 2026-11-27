## Context

- HTML reference: `pen/nodes/detail-view-media-mode.html` (files in media mode).
- Boards: THE DAY stop 05, VERDICT 03, STRUCTURE move 3 ("put the play button on the progress bar"),
  REQUIREMENTS R6, UC6.
- Shipped in `f905b64` (user decisions: external player; short-lived token in the URL): stream links, the
  public range route over librqbit `ManagedTorrent::stream`, the loopback play endpoint, `preferences.player`
  and capability key `stream`.

## Goals / Non-Goals

**Goals:** start a partially downloaded episode from where the progress is, in the browser and the desktop
window; play browser-decodable files without leaving the app; say when an unfinished file can start; disable
Play honestly on engines without streaming.

**Non-Goals:** DLNA/UPnP; transcoding; audio or subtitle track selection beyond what `<video>` does;
streaming on Transmission; piece-order controls.

## Decisions

1. **Token links, not a proxy.** The server reads librqbit's `FileStream` itself and serves ranges on
   `/api/v1/stream/<token>/<name>`. The token is the only credential, so VLC, IINA and mpv work with auth on.
   *Alt:* an authenticated GET route. Rejected because external players cannot send the session cookie, and
   Basic auth in a URL leaks the password.
2. **Built-in player only where a browser can decode.** `INLINE_EXT` (mp4, m4v, webm, mov) opens the overlay;
   everything else goes to the external player (loopback) or copies the link (another device). MKV, HEVC and
   FLAC usually fail in `<video>`, so the external player stays their default. When the overlay hits a decode
   error, it shows the browser's message and the two ways out.
3. **Start check from the model.** `headNeed(file)` = max(2% of size, 8 MiB), capped at the size, minus the
   file's downloaded bytes. The model has no per-file pieces, so all downloaded bytes of the file count
   (marked as a shortcut in code). librqbit's stream fetches the head first anyway.
4. **One Play flow.** `usePlayback` in `DetailPage` serves the hero button, the media view's featured episode
   and the file action buttons, and renders the overlay. `fileActionBlock` gains `need` and returns `notReady`.
5. **Hero button on the progress block.** The largest file, when it is a video. Its label is the reason while
   an unfinished file cannot start yet ("starts once 12 MB more is downloaded", "not supported by
   Transmission").
6. **Link caveat.** The overlay footer says the link works without a login for a few hours and should only be
   shared with trusted people. The link never embeds a password.

## Risks / Trade-offs

- **Head check counts any downloaded bytes**, so with rqbit's out-of-order pieces Play may enable before the
  head is in. The player then buffers. Read the piece bitfield if this misleads users.
- **Token in the URL** is a bearer credential for one file for up to 6 h of idle time. It is cleared with
  sessions (logout or password change).
