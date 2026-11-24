## Why

Three screens still sit outside the new shell. Settings is a modal with a Save button, so it cannot be linked
to, searched, or left half-way; a fresh install drops the user into an empty list with defaults they never saw
(download folder, engine, who can reach the UI); and the login form has two states — empty and "wrong" — with no
lockout, no "remember me" and no way back to where the session expired. The design (`pen/untitled.pen`, screens
18, 19, 20) turns them into a first-run setup, a settings page and a login screen with explicit states.

## What Changes

- **Settings is a page**: its own address per section (`General, Engine, Network, Bandwidth, Queue & seeding,
  Folders, Tabs & query, Terminal & security, Notifications, Appearance, About`), a section rail with search,
  back returns to the tab the user came from. **BREAKING (UI)**: the settings modal and its Save button are
  removed.
- **Changes save automatically**, one control at a time, with inline confirmation and inline errors. Changes
  that restart the engine or need a TorrentX restart are staged behind a "Restart required" banner that says
  what changed and offers *Later* / *Restart engine*; credentials and exposure changes need an explicit Apply.
- **Honest rows**: every row has a one-line explanation; rows the engine cannot do stay visible, disabled, with
  "not supported by <engine>". Adds a port reachability test and a random-port action.
- **First-run setup**: on a fresh install the UI opens a three-step setup — Engine, Library (download folder,
  move completed, starting tabs), Access (loopback only, or network with a password) — skippable in one click,
  downloading nothing, everything editable later. Existing installs never see it.
- **Login screen states**: idle, invalid (attempts left), locked out (live countdown), session expired (returns
  to the view the user was on), plus "remember this browser for 30 days", a plain-HTTP notice, and the host
  command to reset a lost password.
- **Server**: login attempt limiting with a temporary lockout, a non-remembered session lifetime, a setup state
  with a one-shot setup endpoint, a path check, a port test, and `torrentx-server auth reset`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: "Settings screen" (modal → page, auto-save, restart banner, search) and "Login screen" (states,
  remember, lockout); adds "First-run setup".
- `http-api`: "Optional authentication" gains attempt limiting, lockout and remembered sessions; adds setup,
  path-check and port-test endpoints.
- `headless-server`: adds the `auth reset` command.
- `engine-capabilities`: new feature key `portTest`.

## Impact

- `packages/ui`: `Settings.tsx` (574 lines, modal) replaced by `settings/` (`SettingsPage`, `SectionRail`,
  `Row`, `RestartBanner`, one file per section, `useAutosave`); new `setup/SetupWizard` and steps; `Login.tsx`
  rewritten with states; `App.tsx` routes `settings`, gates on setup state and remembers the return view on 401.
- `packages/api-client`: `setup()`, `setupState`, `checkPath()`, `portTest()`, login `remember`, typed
  `locked_out` error with `retryAfterSecs` and `attemptsLeft`.
- `crates/torrentx-server`: `auth.rs` (attempt tracking per client address, lockout, session kinds), `api.rs`
  (`/setup`, `/fs/check`, `/network/port-test`), `config.rs` (`setup_completed`), `main.rs` (`auth reset`
  subcommand), engine dispatch for port test.
- `crates/torrentx-transmission`: `port-test` RPC; `crates/torrentx-rqbit`: `Unsupported`.
- i18n keys in all six dictionaries; docs (`docs/linux-service.md`) mention `auth reset`.
- Depends on `browser-shell-and-spotlight` (routes, tokens, appearance preference) and, for the setup's starting
  tabs, `query-language-and-smart-tabs`.
