## Context

- Source frame: 20 (`IENtA`) with its STATES OF THIS SCREEN legend.
- `auth.rs` has in-memory sessions, argon2, Basic fallback; no attempt tracking.

## Goals / Non-Goals

**Goals:** every state of the screen real; guessing slowed without locking out existing sessions.

**Non-Goals:** multi-user accounts, 2FA, password recovery by email, TLS termination.

## Decisions

1. **Lockout is per client address, in memory**: 5 consecutive failures → 60 s of 429 for login and Basic
   from that address, credentials not evaluated; success resets; valid cookies unaffected.
2. **Two session kinds**: remembered (30 d inactivity, persistent cookie) vs plain (12 h, session cookie).
3. **UI countdown is driven by `retryAfterSecs`** and re-enables itself; the typed value is preserved across
   invalid attempts.
4. **Return path**: on any 401 the UI stores the current address, shows "Your session expired", and navigates
   back after login.
5. **`auth reset`** edits the config file only, refuses non-loopback binds without `--force`.

## Risks / Trade-offs

- **Shared NAT lockout**: one bad client can lock a shared address for 60 s; accepted for single-user use.
