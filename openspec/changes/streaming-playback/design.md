## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`): `detail-view-media-mode.html`
  (10, files in media mode). Read it for layout, spacing and copy; each element carries its canvas name in
  `data-pencil-name`. Colors there are resolved hex values: map them back to theme tokens, never copy the hex.
- Boards: THE DAY stop 05, VERDICT 03 ("our engine makes streaming free"), STRUCTURE move 3 ("put the play
  button on the progress bar"), REQUIREMENTS R6 (P2), UC6.
- rqbit 9 serves seekable HTTP per file (`/ torrents/{id}/stream/{index}` style endpoint on its own HTTP
  listener) and downloads sequentially by default — the head of the file arrives first, so early playback
  works without any piece-order control.
- `torrent-detail-screen` (pending) gives the hero a segmented progress bar, media mode with episode rows, and
  format-aware file actions; `adopt-magic-patterns-ui` (pending) defines the capability matrix and the
  "not supported by <engine>" hint.
- Auth: session cookie or Basic on the server origin; the rqbit listener is a different port, loopback-only,
  and must not be handed to the browser directly (remote users can't reach it, and it bypasses server auth).

## Goals / Non-Goals

**Goals:** start watching a partially downloaded episode from where the progress bar is, in both the browser
and the desktop window, with seeking; honest disablement on engines without streaming.

**Non-Goals:** DLNA/UPnP surfacing; transcoding or audio/subtitle track selection beyond what `<video>` does
natively; a system-player handoff with auth tokens; streaming on Transmission (sequential is not guaranteed,
so no fake); piece-order controls (impossible on rqbit, per VERDICT).

## Decisions

1. **Proxy, don't redirect.** The server streams bytes itself: `GET /torrents/{id}/files/{index}/stream`
   forwards the client's `Range` header to the engine's stream URL and relays status (200/206), `Content-Range`,
   `Content-Length` and `Content-Type`. One origin, one auth story, works for remote users; the engine port
   stays an internal detail. *Alt:* 302 to the engine URL — rejected: breaks remote access and auth.
2. **Playability is derived, not stored.** A file is play-eligible when its extension is a video format
   `<video>` can attempt (mkv/webm/mp4/m4v/avi…; the player surfaces a codec error honestly if the browser
   can't decode it), the `streaming` capability is supported, and the downloaded bytes cover the file's head
   (first ~2% or 8 MB, whichever is larger — a heuristic stated in the UI as "ready to play" only when met).
   No new model fields; no invented durations or titles (media-mode rule).
3. **Inline player overlay.** A modal overlay with `<video controls autoplay>` pointed at the stream URL;
   Escape closes, playback position is per-session only. Works identically in browser and Tauri (the webview
   is the player) — house rule "remote is the same product", zero IPC.
4. **Copy stream URL** copies the absolute server-origin URL. With auth on, the UI notes that external
   players need credentials (Basic in the URL is NOT auto-embedded — never leak the password into a
   clipboard/URL by default).
5. **Capability, not sniffing.** `streaming: {supported, via}` in `/capabilities`; rqbit fills the stream URL
   builder, Transmission returns `Unsupported` → 501 → the UI hint. The play button renders disabled with the
   engine name rather than disappearing (house rule 04).

## Risks / Trade-offs

- **mkv in `<video>`.** Browsers decode only some mkv codecs → the player shows the native decode error with
  a "copy stream URL for an external player" fallback; no transcoding is attempted.
- **Proxy cost.** Bytes pass through the server twice (engine → server → client); acceptable for a
  single-user LAN app, and Range relaying keeps seeks cheap.
- **Head heuristic is wrong sometimes.** "Ready to play" may still buffer; the player buffers honestly rather
  than the UI promising playback.
