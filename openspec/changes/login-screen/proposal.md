## Why

Screen 20 (`pen/untitled.pen`, `IENtA` "Login — web version") defines the sign-in screen with explicit states
(idle, invalid, locked out, session expired, auth disabled). Today the login form has two states — empty and
"wrong" — with no lockout, no "remember me", no plain-HTTP notice and no way back to where the session
expired. This change implements the screen from the ground up and replaces the login portion of the removed
board-derived `setup-settings-page-and-login`.

## What Changes

- **Sign-in screen** as drawn: origin/not-encrypted notice, logo, "Sign in", password field with show/hide,
  remember-for-30-days checkbox, Sign in ⏎, lost-password hint (`torrentx auth reset`), desktop-handoff note.
- **States**: idle (caret in field), invalid (red border, attempts left, typed value kept), locked out
  (disabled action + live countdown), session expired (message + return path to the previous view), auth
  disabled (never rendered).
- **Server**: login attempt limiting per client address (401 with `attemptsLeft`, 429 `locked_out` +
  `retryAfterSecs` after 5 failures for 60 s), remembered (30 d) vs plain (12 h) sessions, and the
  `torrentx-server auth reset` command.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: adds "Login screen" states and layout (extends the base login requirement).
- `http-api`: "Optional authentication" gains lockout and remembered sessions.
- `headless-server`: adds the `auth reset` command.

## Impact

- `packages/ui`: `Login.tsx` rewritten with states; `App.tsx` remembers the return view on 401.
- `packages/api-client`: login `remember`, typed `locked_out` error with `retryAfterSecs`/`attemptsLeft`.
- `crates/torrentx-server`: `auth.rs` attempt tracking, session kinds; `main.rs` `auth reset`;
  `docs/linux-service.md` mentions it.
- Depends on `active-tab-screen` (addresses for the return path).
