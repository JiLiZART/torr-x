## Purpose

Gives media torrents and their files a cover image, taken from the torrent's own content first and, only when
the user opts in, from an online lookup by title.

## ADDED Requirements

### Requirement: Cover fields and image endpoints
Every torrent in `GET /api/v1/torrents` and `GET /api/v1/torrents/{id}` SHALL carry `cover`, and every entry
of `files` SHALL carry `cover`: an opaque version string when a cover exists, else `null`. The string SHALL
change whenever the cover image changes. `GET /api/v1/torrents/{id}/cover` and
`GET /api/v1/torrents/{id}/files/{index}/cover` SHALL return the image with its image content type, or
`not_found` when there is none. A request carrying the current version as `?v=` SHALL be answered with a
long-lived immutable cache header. Image responses SHALL forbid content-type sniffing and script execution.

#### Scenario: No cover
- **WHEN** a torrent has no cover
- **THEN** its `cover` is `null` and `GET /torrents/{id}/cover` answers `not_found`

#### Scenario: Version changes with the image
- **WHEN** a torrent's cover is replaced by another image
- **THEN** its `cover` string differs from the previous one

### Requirement: Cover from the torrent's image files
The server SHALL choose a torrent's cover from its own image files (`jpg`, `jpeg`, `png`, `gif`, `webp`; at
most 20 MB) without any client being connected: a file named `poster.<ext>` in the torrent root first;
otherwise, when audio is the kind with the most bytes, the image whose name best matches `cover`, `folder`,
`album` or `front` (then `back`; names containing `spectrogram` last), the larger file on a tie; when images
are the kind with the most bytes, the largest image. The chosen file SHALL become the cover when it is fully
downloaded. SVG files SHALL never be used.

#### Scenario: Poster file
- **WHEN** a video torrent contains `poster.jpg` in its root and that file finishes downloading
- **THEN** within one policy interval (≤ 10 s) the torrent's `cover` is set and the endpoint returns that image

#### Scenario: Album art
- **WHEN** an album torrent contains `back.jpg`, `folder.jpg` and `spectrogram.png`
- **THEN** `folder.jpg` is the cover

#### Scenario: Not downloaded yet
- **WHEN** the chosen image file is still downloading
- **THEN** `cover` is `null`

### Requirement: Uploaded video frames
`PUT /api/v1/torrents/{id}/files/{index}/cover` with a JPEG, PNG or WebP body of at most 512 KB SHALL store the
image as that video file's cover and return its version. A body of another type, a larger body, or an `index`
that is not a video file SHALL fail with `invalid_input`. When the torrent has no cover from its image files or
from the online lookup, the frame of its largest video file SHALL also be the torrent's cover.

#### Scenario: Frame becomes the torrent cover
- **WHEN** a video torrent has no cover and a client uploads a frame for its largest video file
- **THEN** both that file's `cover` and the torrent's `cover` are set

#### Scenario: Not an image
- **WHEN** a client uploads a body that is not a JPEG, PNG or WebP image
- **THEN** the response is `invalid_input` and nothing is stored

### Requirement: Cover per file
A file's cover SHALL be: for an image file, the file itself once fully downloaded; for a video file, its
uploaded frame or, with the online lookup on, its episode image; for an audio file, the image chosen by the
album-art rule among the images in the same folder, else the torrent's cover. Other files SHALL have
`cover: null`.

#### Scenario: Two albums in one torrent
- **WHEN** a torrent has folders `A/` and `B/`, each with its own `cover.jpg`
- **THEN** the audio files in `A/` report the cover from `A/cover.jpg` and those in `B/` the one from
  `B/cover.jpg`

#### Scenario: Image file
- **WHEN** a downloaded `scan01.png` is listed
- **THEN** its `cover` is set and its endpoint returns the file's own bytes

### Requirement: Opt-in online lookup
The online lookup SHALL be off by default. `GET /api/v1/settings` SHALL report `covers: {onlineLookup,
hasApiKey}`; `PUT /api/v1/settings` SHALL accept `covers.onlineLookup` and `covers.apiKey`, and the key SHALL
never be returned. With the lookup on and a key set, `POST /api/v1/torrents/{id}/cover/lookup` with `{kind:
"movie"|"tv", title, year?, season?, episode?, file?}` SHALL search the lookup service, store the first
match's poster as the torrent's cover (or, when `file` is given, the episode image as that file's cover) and
return `{cover}`; with no match it SHALL return `{cover: null}`. With the lookup off or no key it SHALL fail
with `unsupported`. A second lookup for the same torrent or file SHALL return the stored result without a new
request to the service. A lookup result SHALL NOT replace a cover that comes from the torrent's image files.

#### Scenario: Off by default
- **WHEN** a fresh server receives a lookup request
- **THEN** it answers `unsupported` and makes no outbound request

#### Scenario: Poster found
- **WHEN** the lookup is on and a client posts `{kind: "movie", title: "Big Buck Bunny", year: 2008}` for a
  torrent that has only a captured frame
- **THEN** the torrent's `cover` changes to the poster

#### Scenario: Local image wins
- **WHEN** the torrent already has a cover from its `poster.jpg`
- **THEN** a lookup leaves `cover` unchanged

#### Scenario: Key is write-only
- **WHEN** a client sets `covers.apiKey` and reads the settings back
- **THEN** the response contains `hasApiKey: true` and no key text

### Requirement: Lookup privacy
A lookup SHALL send to the lookup service only the `title`, `year`, `season` and `episode` values of the
request. The info-hash, torrent name, file names, paths and trackers SHALL NOT be sent. With the lookup off,
the server SHALL make no outbound request for covers.

#### Scenario: What leaves the machine
- **WHEN** a lookup runs for a torrent named `Big.Buck.Bunny.2008.1080p.x264-GRP`
- **THEN** the outbound request contains `Big Buck Bunny` and `2008`, and neither the full name nor the
  info-hash

### Requirement: Removing a cover
`DELETE /api/v1/torrents/{id}/cover` and `DELETE /api/v1/torrents/{id}/files/{index}/cover` SHALL remove the
cover, set `cover` to `null`, and prevent any automatic source from setting it again for that torrent or file.
Removing a torrent SHALL delete its stored covers.

#### Scenario: Stays removed
- **WHEN** the user removes a torrent's cover and a client later uploads a frame for its largest video file
- **THEN** the file's `cover` is set and the torrent's `cover` stays `null`
