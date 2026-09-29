# web-ui Specification

## Purpose
Defines the browser-based TorrentX UI served by the server and shown in the desktop window: torrent management, settings, and login, driven solely through the HTTP API.

## Requirements

### Requirement: HTTP-only data access
The web UI SHALL obtain all data and perform all actions through the `/api/v1/*` HTTP API on its own origin, and SHALL NOT depend on Tauri IPC, so the identical build works in a browser and in the desktop window.

#### Scenario: Plain browser
- **WHEN** the UI is opened in a regular browser with no Tauri runtime
- **THEN** every feature works

### Requirement: Torrent list with live refresh
The UI SHALL show all torrents with name, size, progress, status, download/upload rate, peers/seeds, and ETA, and SHALL refresh the list at least every 2 seconds while the page is visible. It SHALL keep the existing terminal look (green-on-black, monospace).

#### Scenario: Live progress
- **WHEN** a torrent is downloading
- **THEN** its progress and rates update in the list without a page reload

#### Scenario: Engine unavailable
- **WHEN** the API returns `engine_unavailable`
- **THEN** the UI shows a visible banner with the error message and a link to settings, instead of an empty list with no explanation

### Requirement: Torrent actions
The UI SHALL let the user add a torrent by magnet/URL text input or by choosing/dropping a `.torrent` file, pause, resume, remove (with a choice to also delete data, which requires an explicit confirmation), and view details including the file list.

#### Scenario: Add magnet
- **WHEN** the user pastes a magnet link and submits
- **THEN** the torrent appears in the list

#### Scenario: Remove with data
- **WHEN** the user chooses remove with delete data
- **THEN** the UI asks for confirmation in-page and only then calls the API with `deleteData=true`

#### Scenario: Action error
- **WHEN** an action fails (e.g. `invalid_input` for a bad magnet)
- **THEN** the UI shows the API error message

### Requirement: Settings screen
The UI SHALL provide a settings screen to view and edit: bind address, port, allowed extra hosts, auth on/off with username and password, engine (rqbit or Transmission), rqbit download directory, and Transmission RPC URL/username/password. After saving, the UI SHALL display a notice when `restartRequired` is returned, and SHALL warn when bind address is non-loopback while auth is disabled.

#### Scenario: Enable auth
- **WHEN** the user enables auth with username and password and saves
- **THEN** settings persist and the user stays logged in

#### Scenario: Exposed without auth warning
- **WHEN** the user sets bind address to `0.0.0.0` with auth disabled
- **THEN** the UI shows a warning before saving

### Requirement: Login screen
When auth is enabled and the user is not authenticated, the UI SHALL show a login form; on success it SHALL show the torrent list. When auth is disabled, no login form SHALL ever appear. The UI SHALL offer a Log out action when auth is enabled.

#### Scenario: Session expired
- **WHEN** any API call returns 401
- **THEN** the UI switches to the login form, and after login returns to the list
