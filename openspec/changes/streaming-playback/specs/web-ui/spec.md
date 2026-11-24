## ADDED Requirements

### Requirement: Play from the progress bar
The detail hero's progress bar and each media-mode episode row SHALL offer a play action for video files when
the `streaming` capability is supported. The action SHALL be enabled once the file's downloaded head covers
the start heuristic (first ~2% or 8 MB, whichever is larger) and labeled "ready to play" only then; before
that it SHALL show how much is still needed. Playing SHALL open an inline player overlay using the server's
stream endpoint, with native seeking, Escape to close, and the browser's native decode errors shown honestly
with a "copy stream URL" fallback. Where streaming is unsupported the affordance SHALL be disabled with the
engine hint; non-video files SHALL have no play affordance. A "Copy stream URL" action SHALL copy the
server-origin URL and SHALL NOT embed credentials; with auth on, the UI SHALL note that external players need
authentication.

#### Scenario: Movie night at 40%
- **WHEN** an episode is 40% downloaded on rqbit and the user presses play on the hero progress bar
- **THEN** the inline player starts playing from the beginning and can seek within the downloaded range

#### Scenario: Not ready yet
- **WHEN** a video file has downloaded less than its start heuristic
- **THEN** the play affordance is disabled and says how much more is needed

#### Scenario: Codec the browser cannot decode
- **WHEN** the player cannot decode the file
- **THEN** the overlay shows the decode error and offers "Copy stream URL" for an external player

#### Scenario: Engine without streaming
- **WHEN** the active engine is Transmission
- **THEN** the play affordance is visible but disabled with "not supported by Transmission"
