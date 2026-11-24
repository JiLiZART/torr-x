## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`): `empty-library.html` (17);
  `first-run.html` (18). Read it for layout, spacing and copy; each element carries its canvas name in
  `data-pencil-name`. Colors there are resolved hex values: map them back to theme tokens, never copy the hex.
- Source frames: 17 (`X2irCa`) and 18 (`CnhUq`); house rule 01 (defaults that need no attention).
- `active-tab-screen` provides the shell and tabs-as-queries; `add-flow-and-theming` provides the add flow
  the empty state's actions open; the zero-results state already owns the filtered-empty case.
- Server: `config.rs` loads/creates config; `health` exists; no setup state today.

## Goals / Non-Goals

**Goals:** a fresh install that orientates (17) and asks exactly three questions (18); every default working
without attention; nothing downloaded during setup; existing installs untouched.

**Non-Goals:** the settings page (everything the wizard skips lives there), login/auth hardening
(`login-screen`), engine installation or updates, per-OS folder pickers beyond the server path check.

## Decisions

1. **Empty library is a list-area state, keyed on total 0.** Not a route, not a lens outcome. Copy is fixed
   and explicit ("this is not a filter"); the three orientation cards are the only place the product teaches
   scope/lens/query outside the boards. The top bar caption and filter placeholder change with it so no
   surface implies a filter exists.
2. **Wizard is a gate, not a route.** `App.tsx` renders it when `health.setupRequired`; Skip posts `{}`.
   Steps are local state; only the final Continue (or Skip) calls `POST /setup` once. Back never loses entered
   values. The step rail shows checks for completed steps.
3. **Validate-all-then-apply on the server.** `/setup` parses the whole subset (engine, downloadDir,
   moveCompleted, tabs, access) and rejects atomically; a non-loopback bind without auth is `invalid_input`.
   Tabs given replace the tab set exactly, in order; omitted means keep seeded defaults. Completion is
   one-way (409 afterwards); pre-existing configs report `setupRequired: false` forever.
4. **Path check backs the writable row.** `POST /fs/check` resolves the nearest existing ancestor for
   `writable`/`freeBytes`, creates nothing, lists nothing; the wizard debounces it on input and shows
   "must be writable" in red until true. Browse… uses the desktop dialog plugin when present, else a typed
   path (browser).
5. **Starting tabs are queries, shown as queries.** Each picker row shows name, pin badge and the query text
   in mono — the wizard teaches the model by example. Unchecking All is allowed but warned (it is the escape
   hatch); the server accepts any list.
6. **Step 3 default is loopback, no password.** Choosing network exposure requires setting a password inline
   (same validation as settings) or going back; the footer states the default plainly.

## Risks / Trade-offs

- **Wizard fatigue.** → One-click Skip with working defaults; three steps, no account creation, no downloads.
- **Setup race with a second client.** → One-shot endpoint; the second client's post gets 409 and the UI
  proceeds into the app.
- **Empty state vs zero-results confusion.** → Different copy, different actions, different condition
  (total 0 vs filtered 0); a test asserts both never render together.
