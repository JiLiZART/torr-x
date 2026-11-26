## Context

See proposal.md for why. Current shape:

- `lib/media.ts` (UI, pure, tested) parses show title, season, episode and quality from file names. The server
  parses nothing from names.
- `POST /torrents/{id}/files/{index}/stream` issues a same-origin stream URL for engines that can stream
  (`Engine::can_stream`: rqbit yes, Transmission no).
- The server has `reqwest` already (Transmission RPC) and no image or media library.
- `state.json` holds per-torrent records; the server data directory is `<data_dir>/torrentx`.
- Reference: WebTorrent Desktop `src/renderer/lib/torrent-poster.js` (selection rules, frame at
  `min(duration * 0.03, 60 s)`), which stores posters as `<infoHash>.<ext>` and never goes online.

## Goals / Non-Goals

**Goals:**
- No new Rust dependency for local covers.
- Covers are shared by all clients of one server.
- Nothing leaves the machine unless the user turned the lookup on.

**Non-Goals:**
- ffmpeg or any server-side video decoding.
- Guaranteeing a cover for every torrent. No cover is a normal state.

## Decisions

### Source order
For a torrent's cover, first match wins:

1. An image file from the torrent, chosen by the rules below.
2. An online poster, when the lookup is on and finds a match.
3. A captured video frame.

A frame is a guess at a cover, while a poster is one, so with the lookup on the poster outranks the frame.
With the lookup off (the default) the order is 1 then 3: local only. A later, better source replaces an earlier
one (a frame is replaced when a poster arrives); a removed cover is never replaced.
- *Alternative*: frame before online — users who opt in would still see a random frame on most films.

### Image file rules are WebTorrent's, as a pure function
`pick_cover(files) -> Option<index>`:
- a file named exactly `poster.jpg|jpeg|png|gif|webp` in the torrent root wins;
- else sum bytes per kind (audio, video, image) over the wanted files; the largest kind decides;
- audio: the image with the best name score (`cover`, `folder`, `album`, `front` = 80; `back` = 20;
  `spectrogram` = -80; substring match, else 0), ties to the larger file;
- image: the largest image file;
- video: no image file is used (step 3 or 2 applies).

Only `jpg`, `jpeg`, `png`, `gif`, `webp` count as images. SVG is excluded: served from the app's origin it
could run script. The picked file becomes the cover once it is fully downloaded; the policy tick checks this,
so no client needs to be open.

### Per-file covers
- image file: itself;
- video file: its own captured frame, or with the lookup on and an episode parsed, the episode still;
- audio file: `pick_cover` over the images in the same folder, else the torrent's cover;
- anything else: none.

### Frames are captured by the browser and uploaded
The UI plays the stream URL in a hidden muted `<video>`, seeks to `min(duration * 0.03, 60 s)`, draws the frame
on a canvas and uploads a JPEG at most 640 px wide. The stream is same-origin, so the canvas is readable. The
upload is `PUT /torrents/{id}/files/{index}/cover`; the server checks the magic bytes and size and stores it.
The torrent's frame is the frame of its largest video file.
- Capture runs when the detail page of a video torrent without a cover opens, one file at a time, only for
  files whose head is downloaded; media view rows capture when they scroll into view.
- List rows do the same when they come on screen: the list has no files, so the row fetches the torrent's
  details once per session (again when it completes) and then follows the page's steps.
- No Rust crate decodes H.264 / HEVC / AV1 without ffmpeg or system codecs, so capture stays in the browser.
  WebTorrent's `capture-frame` package is the same `<video>` → canvas → `toBlob` call written here; it is not
  added as a dependency.
- A failed capture (codec the browser cannot decode, stream not ready) is remembered for the session and not
  retried in a loop.
- *Alternative*: ffmpeg on the server — a large external dependency for a headless binary that today has none.
- *Alternative*: keep frames in the browser only (like WebTorrent) — each device would capture again and the
  desktop window (WebKit) decodes less than Chrome.

### Online lookup: the UI parses, the server asks
The title parser lives in the UI. `POST /torrents/{id}/cover/lookup` takes `{kind: "movie"|"tv", title, year?,
season?, episode?, file?}`; the server calls TMDB with its stored key, takes the first result, downloads the
poster (or the episode still when `file` is given) into the cache and returns the new cover version. The server
records that a lookup was tried for that torrent or file, so clients do not repeat it.
- TMDB (checked against developer.themoviedb.org in task 3.1): `GET /3/search/movie|tv?query=&year=` (for TV,
  `year` matches the first air date and every episode air date, which fits a year taken from a release name
  better than `first_air_date_year`), then for an episode `GET /3/tv/{series_id}/season/{s}/episode/{e}`; images
  from `https://image.tmdb.org/t/p/w780<poster_path>` and `/w300<still_path>`. A v3 key goes in the `api_key`
  query parameter; a v4 read access token (a JWT) goes in `Authorization: Bearer`. Both are accepted in the one
  key field.
- A failed request (bad key, service down) answers `lookup_failed` (502) and is not recorded, so it is tried
  again in a later session; "no match" is recorded.
- The key is the user's own, stored like the Transmission password: in the 0600 config file, never returned
  (`hasApiKey` only).
- The server does the request, not the browser: the key stays on the server, the cache is shared, and the UI
  needs no cross-origin permission.
- *Alternative*: parse names in Rust — a second copy of `lib/media.ts` to keep in step.
- *Alternative*: a built-in shared API key — it would ship in an open-source binary and be revoked.

### What goes out
Per lookup: the parsed title, the year if present, and season and episode numbers. Never the info-hash, file
names, paths, tracker or the raw torrent name. The settings text says exactly this.

### Cover version instead of a boolean
`Torrent.cover` and `FileInfo.cover` are short opaque strings that change when the cover changes, or `null`.
The UI requests `/cover?v=<version>`, and the server answers with a one-year immutable cache header. A list of
300 torrents then costs no cover requests after the first view and no 404s for torrents without covers.

### Storage
`<data_dir>/covers/<id>/torrent.<ext>` (poster), `f<index>.<ext>` (frame) and `o<index>.<ext>` (episode still). Covers that
are image files of the torrent are not copied; the record points at the file index and the bytes are read from
the download. `state.json` gets `covers: {<id>: {torrent, files, removed, lookedUp}}` (optional, default
empty). Removing a torrent deletes its record and its cache folder.

### Serving
Responses carry the image type detected from the magic bytes, `X-Content-Type-Options: nosniff` and
`Content-Security-Policy: default-src 'none'; sandbox`. Uploads are limited to 512 KB and JPEG / PNG / WebP;
torrent image files over 20 MB are not used as covers.

## Risks / Trade-offs

- [Many video torrents get no local cover: MKV and HEVC often do not decode in the browser, Transmission cannot
  stream] → that is the stated limit of local sources; the hero falls back to today's look; the lookup is the
  remedy.
- [Wrong online match] → "Remove cover" clears it and blocks automatic replacement for that torrent or file.
- [A malicious image file in a torrent] → the server never decodes images; it serves bytes with a fixed image
  type, nosniff and a sandboxing CSP; SVG is excluded.
- [Any API client can upload a "frame"] → uploads are behind the same auth, Host and Origin guards as every
  mutating request, limited in size and type.
- [Cover cache grows] → one small image per torrent and per video file, deleted with the torrent.
- [TMDB terms require attribution] → while the lookup is on, the Covers settings group and Settings → About
  show the required notice ("This product uses the TMDB API but is not endorsed or certified by TMDB."). The
  terms also ask for the TMDB logo; it is not bundled yet.
- [A stream link resumes a paused torrent and selects the file] → capture runs only for a wanted file of a
  downloading or seeding torrent with at least 10% of the file, once while it downloads and once when complete.
- [rqbit reported file paths without the torrent's folder, so the image file was not found on disk] → fixed in
  `torrentx-rqbit`: paths are relative to the save path, as with Transmission. This also repairs Open / Reveal
  for multi-file torrents on rqbit, and adds the folder as the top row of the Files tree.

## Migration Plan

No migration. Existing torrents get local covers on the first policy ticks after the upgrade. Rollback: an
older binary ignores `covers` in `state.json` and the `covers/` folder.

## Addendum: files the browser's player rejects

`<video>` cannot open MKV in WebKit, so the capture has two fallbacks, tried in order: (1) `decodeFrame` reads the
container in JS over range requests and decodes one frame with WebCodecs; (2) the server runs the `ffmpeg` installed
on its machine on a complete file and stores the JPEG as an uploaded frame would be. This relaxes "the server has no
decoder" only as an optional external tool: TorrentX does not bundle or require ffmpeg, and the server still decodes
nothing itself. The ffmpeg path needs no stream link, so it also serves paused torrents and Transmission.
