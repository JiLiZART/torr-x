## ADDED Requirements

### Requirement: Login screen
When auth is enabled and the user is not authenticated, the UI SHALL show a sign-in screen with a password
field holding the caret, a "remember this browser for 30 days" choice and a sign-in action; on success it SHALL
show the view the user asked for. The screen SHALL have these states:
- invalid: after a wrong password it SHALL say the password is incorrect and how many attempts remain, keeping
  what was typed so it can be corrected;
- locked out: while the server refuses attempts it SHALL disable the sign-in action and show a countdown to
  when it can be tried again, re-enabling on its own;
- session expired: when a signed-in user's session ends, it SHALL say so and, after signing in, return to the
  view the user was on.
The screen SHALL say how to reset a lost password from the host, and SHALL state that the connection is not
encrypted when it is served over plain HTTP to a non-loopback address. When auth is disabled, no sign-in screen
SHALL ever appear. The desktop window SHALL NOT show it. The UI SHALL offer a Log out action when auth is
enabled.

#### Scenario: Session expired
- **WHEN** any API call returns 401 while the user is on a torrent's Peers section
- **THEN** the UI shows the sign-in screen saying the session expired, and after signing in returns to that
  Peers section

#### Scenario: Wrong password
- **WHEN** the user submits a wrong password
- **THEN** the screen says it is incorrect and shows the remaining attempts, and the typed password is still in
  the field

#### Scenario: Locked out
- **WHEN** the server answers that sign-in is locked for 47 seconds
- **THEN** the sign-in action is disabled with a countdown from 47 s and becomes available when it reaches zero

#### Scenario: Remember this browser
- **WHEN** the user signs in with "remember" checked, closes the browser and opens the UI the next day
- **THEN** no sign-in is required

#### Scenario: Not remembered
- **WHEN** the user signs in without "remember" and restarts the browser
- **THEN** the sign-in screen is shown again

#### Scenario: Auth disabled
- **WHEN** auth is off
- **THEN** the UI opens directly on the list and never shows the sign-in screen

Layout: a browser-chrome note above the card shows the origin and, over plain HTTP to a non-loopback address,
the warning "not encrypted — put it behind a reverse proxy for remote access". The card shows the logo, the
title "Sign in", "This TorrentX instance requires a password for the web UI.", a password field with show/hide,
the inline error line with a red field border, the remember checkbox, the Sign in action with ⏎, and the line
"Lost the password? Reset it from the host: torrentx auth reset". The footer notes that the desktop app signs
itself in with a one-time handoff token and never shows this screen.

#### Scenario: Plain HTTP notice
- **WHEN** the UI is served over HTTP at `http://192.168.1.14:9977/`
- **THEN** the page shows the "not encrypted" notice above the card

#### Scenario: Invalid state as drawn
- **WHEN** a wrong password is submitted with attempts left
- **THEN** the field border turns red and the line reads "Incorrect password — 3 attempts left before a 60 s
  lockout."
