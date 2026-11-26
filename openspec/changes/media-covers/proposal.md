## Why

A media torrent's detail page looks the same as any other: a name and a progress bar. The torrent usually
carries its own artwork (a `poster.jpg`, an album `cover.jpg`, or the video itself), and WebTorrent Desktop has
shown for years that this is enough to give a library a face. TorrentX has the media view and the stream
endpoint already; it lacks the cover.

## What Changes

- **Torrent cover from local sources**: the server picks a cover from the torrent's own image files with
  WebTorrent Desktop's rules (a `poster.*` file first, then by dominant media type and file-name score).
- **Video frame as a cover**: when no image file fits, the UI captures one frame from the largest video file
  through the existing stream endpoint and uploads it. Only where the engine can stream and the browser can
  decode the file.
- **Cover per media file**: an image file is its own cover; a video file gets its own captured frame; an audio
  file gets the best image in its folder, else the torrent's cover.
- **Opt-in online lookup**: off by default. When the user turns it on and enters their own TMDB API key, the
  server looks up a poster by the title and year parsed from the name, and an episode still for episode files.
  Only that title, year and season/episode number are sent.
- **Model**: `Torrent.cover` and `FileInfo.cover` hold a cover version or `null`; images are served from
  `GET /torrents/{id}/cover` and `GET /torrents/{id}/files/{index}/cover`.
- **Cover cache**: captured frames and downloaded posters are stored by the server under its data directory, so
  every browser and the desktop window show the same covers.
- **UI**: the detail hero and the torrent list rows draw the cover as a dimmed background; media view rows show a thumbnail; a
  "Remove cover" action clears a wrong one; Settings → Appearance gets a Covers group.

## Capabilities

### New Capabilities
- `media-covers`: cover sources and their order, per-file covers, the cover fields and endpoints, the cover
  cache, the opt-in online lookup and what it sends, and removal.

### Modified Capabilities
- `web-ui`: adds the hero and list-row cover backgrounds, media view thumbnails, frame capture and the Covers settings group.

## Impact

- **Crates**: `torrentx-core` (`Torrent.cover`, `FileInfo.cover`), `torrentx-server` (new `covers.rs`: pure
  selection rules, cache directory, TMDB client on the existing `reqwest`; `api.rs` routes; `config.rs`
  `[covers]` section with the API key; `store.rs` cover records; `policy.rs` tick picks local covers).
- **TS**: `packages/api-client` types and the drift fixture, `packages/ui` (`Hero`, media view rows,
  `lib/cover.ts` frame capture, settings group, i18n in six dictionaries).
- **Network**: with the lookup on, the server calls `api.themoviedb.org` and `image.tmdb.org`. With it off,
  no request leaves the machine for covers.
- **Docs**: `CLAUDE.md` design point "titles and quality come only from file names" gains the opt-in exception.
- **Ordering with `multi-provider-engines`**: written for bare info-hash ids; cover records become
  provider-scoped like the other `state.json` keys when that change lands.
- **Non-goals**: embedded audio art (ID3, FLAC pictures); image resizing or
  transcoding on the server; choosing a cover by hand from candidates; lookup providers other than TMDB;
  ratings, plots or any other online metadata.
