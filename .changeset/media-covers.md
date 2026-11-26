---
default: minor
---

# Covers for media torrents and their files

A torrent's page and its row in the list now show its cover as a background, and the media view shows a thumbnail
per episode. The cover
comes from the torrent itself: a `poster.jpg` in its root, album art (`cover`, `folder`, `album`, `front`) for music,
or one frame of the video, captured in the browser through the stream link and stored on the server so every device
shows the same image. "Remove cover" in the header menu clears a wrong one for good.

An online lookup is available and off by default: Settings → Appearance → Covers takes your own TMDB API key and then
fetches a poster (and episode stills) by title. Only the title, year, season and episode number are sent.

API: `Torrent.cover` and `FileInfo.cover` hold a version string or `null`; images are at
`GET /torrents/{id}/cover` and `GET /torrents/{id}/files/{index}/cover`, with `PUT` / `DELETE` on the same paths
and `POST /torrents/{id}/cover/lookup`. Settings gain `covers {onlineLookup, hasApiKey}`.

Fixed: with rqbit, the files of a multi-file torrent had paths without the torrent's folder, so "Open" and "Reveal"
looked in the wrong place. File paths are now relative to the save path on both engines.

MKV and other files the browser's player rejects get a frame too: the UI decodes one itself, and a server with `ffmpeg` installed takes the frame from finished files, also for paused torrents.
