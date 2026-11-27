## ADDED Requirements

### Requirement: Play from the progress
The detail hero's progress block SHALL offer Play for the largest file when it is a video; the media view's
featured episode and the video file actions SHALL use the same Play flow. A finished file SHALL always be
playable. An unfinished file SHALL be playable when the `stream` capability is supported and its downloaded
bytes cover the head (2% of the file or 8 MiB, whichever is larger); the hero button SHALL then read "Ready
to play". Before that, Play SHALL be disabled and say how much more is needed. Where streaming is
unsupported, Play for unfinished files SHALL be disabled with the engine hint. Non-video files SHALL have no
Play.

#### Scenario: Movie night at 40%
- **WHEN** an mp4 is 40% downloaded on rqbit and the user presses Play on the hero
- **THEN** the built-in player starts from the beginning and can seek within the downloaded range

#### Scenario: Not ready yet
- **WHEN** a video file has downloaded less than its head
- **THEN** Play is disabled and says how much more is needed

#### Scenario: Engine without streaming
- **WHEN** the active engine is Transmission and the file is unfinished
- **THEN** Play is visible but disabled with "not supported by Transmission"

### Requirement: Built-in player or external player
Files a browser can decode (mp4, m4v, webm, mov) SHALL play in an overlay with `<video controls autoplay>` on a
stream link, with native seeking and Escape to close. Other video files SHALL open in the machine's video
player when the browser runs on that machine, and otherwise SHALL copy the stream link with a notice. When
the overlay cannot decode the file, it SHALL show the browser's error, "Copy stream link" and, on the machine
itself, "Open in video player". The copied link SHALL be the server-origin URL with its token and SHALL NOT
embed a password; the overlay SHALL say the link works without a login for a few hours.

#### Scenario: MKV on the machine itself
- **WHEN** the user presses Play on an MKV in the desktop window
- **THEN** it opens in the configured or detected video player, not in the overlay

#### Scenario: Codec the browser cannot decode
- **WHEN** the overlay cannot decode an mp4
- **THEN** it shows the decode error with "Copy stream link" and "Open in video player"
