# app-preferences Specification

## Purpose
UI and OS-level preferences (language, theme, dates, notifications, autostart, update checks) stored by the server so they apply uniformly to the browser UI and the desktop app.

## Requirements

### Requirement: Preference storage
The server SHALL store under `preferences`: `startWithSystem`, `startMinimized`, `confirmExitWhileDownloading`,
`checkForUpdates`, `language` (en|fr|de|es|ru|zh), `appearance` {`mode` (system|light|dark), `accent`
(green|cyan|amber|violet)}, `showSpeedGraph`, `showPieceMap`, `dateFormat` (relative|absolute|iso),
`notifications` {enabled, onComplete, onAdd, sound}. Invalid enum values SHALL be rejected with `invalid_input`.
The former `theme` and `useSystemTheme` preferences SHALL no longer be returned; a stored configuration that
still holds them SHALL be converted on load — `useSystemTheme` on becomes mode `system`, theme `light` becomes
mode `light`, `hacker` becomes mode `dark` with accent `green`, `dark-blue` becomes mode `dark` with accent
`cyan`. A fresh configuration SHALL default to mode `system` and accent `green`. Desktop-only preferences SHALL
be editable in any client and SHALL be marked "desktop app only" in the UI.

#### Scenario: Invalid language
- **WHEN** a client PUTs `language: "xx"`
- **THEN** the response is 400 `invalid_input`

#### Scenario: Invalid mode
- **WHEN** a client PUTs `appearance: {"mode": "sepia"}`
- **THEN** the response is 400 `invalid_input`

#### Scenario: Stored theme is converted
- **WHEN** the server starts with a configuration holding `theme = "dark-blue"` and `useSystemTheme = false`
- **THEN** `GET /api/v1/settings` returns `appearance: {"mode": "dark", "accent": "cyan"}` and no `theme` key

#### Scenario: System theme carries over
- **WHEN** the stored configuration has `useSystemTheme = true`
- **THEN** `appearance.mode` is `system`

### Requirement: Update check
When `checkForUpdates` is on, the UI SHALL at most once per day compare the server version from `/api/v1/health` with the latest published TorrentX release and show a dismissible notice with a link when newer. When off, no network request for updates SHALL be made.

#### Scenario: Newer release
- **WHEN** the latest release is newer than the running version
- **THEN** a notice "TorrentX <version> available" with a link is shown once per version until dismissed

#### Scenario: Disabled
- **WHEN** `checkForUpdates` is off
- **THEN** no update request is made
