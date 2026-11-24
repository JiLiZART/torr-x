## MODIFIED Requirements

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
