## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`): `settings.html` (19). Read it
  for layout, spacing and copy; each element carries its canvas name in `data-pencil-name`. Colors there are
  resolved hex values: map them back to theme tokens, never copy the hex.
- Source frame: 19 (`pETNK`); house rules 01 and 04 (defaults, disabled controls explain themselves).
- Current `Settings.tsx` is a 574-line modal with one Save; settings API already has sections and
  `restartRequired`; capabilities matrix exists.
- `active-tab-screen` provides addresses and back; `add-flow-and-theming` provides `appearance`.

## Goals / Non-Goals

**Goals:** a linkable, searchable page; one-control-at-a-time saving; explicit staging for restarts and
exposure changes; honest unsupported rows.

**Non-Goals:** new settings beyond those named in the screen and existing specs; per-section redesign of
Queue/Folders/Tabs content beyond the shared row pattern; import/export of settings.

## Decisions

1. **Row is the unit.** `Row {title, description, control, capability?}` owns its save state (idle → saving →
   saved ✓ → error with revert). `useAutosave` debounces text inputs, commits toggles/selects immediately,
   and PUTs only the changed key.
2. **Three change classes.** Ordinary → immediate PUT. Engine-restarting (port, engine type, proxy) → staged
   in a page-level pending set shown by `RestartBanner` (names each change, Later / Restart engine; leaving
   with pending asks to discard). Exposure/credentials (bind, auth, allowed hosts) → explicit Apply with the
   non-loopback-without-auth warning.
3. **Capabilities drive rows.** Each row declares a capability key; unsupported → disabled + "not supported by
   <engine>" with the badge shown in the screen (`ban`), never hidden.
4. **Search is client-side over a row registry** (title + description + section); choosing a hit routes to
   `settings/<section>#<row>` and scrolls/highlights.
5. **Port test is user-initiated only**, result cached in memory with its timestamp ("2 minutes ago").
6. **Addresses**: `settings/<section>`; back returns to the originating view via the navigation history.

## Risks / Trade-offs

- **Auto-save of risky values.** → Risky classes are staged (restart) or explicit (exposure); validation
  errors revert only that row.
- **Staged changes lost on navigation.** → Leave guard asks before discarding.
