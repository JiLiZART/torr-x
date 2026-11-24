## 1. Server: authentication

- [ ] 1.1 `auth.rs`: per-address failure counter (5 failures → 60 s lockout, pruned on a timer), 401 with
      `attemptsLeft`, 429 `locked_out` with `retryAfterSecs` + `Retry-After` for login and Basic; valid cookies
      bypass it; verify unit tests with an injected clock and tower `oneshot` tests for the lockout scenarios
- [ ] 1.2 Session kinds: `remember` → 30-day sliding TTL + `Max-Age`; otherwise 12-hour sliding TTL and a
      session cookie; verify tests on the `Set-Cookie` header and on expiry with the injected clock
- [ ] 1.3 `main.rs`: `auth reset [--force]` subcommand (loopback check, idempotent, does not start the server);
      document it in `docs/linux-service.md`; verify tests on a temp config for the three scenarios

## 2. Server: setup, path check, port test

- [ ] 2.1 `config.rs`: `setup_completed` (false only for a file the server just created, true when the key is
      missing from an existing file); `GET /health` → `setupRequired`; verify tests for fresh, existing-without-
      key and completed configs
- [ ] 2.2 `POST /api/v1/setup`: validate-then-apply as one settings change, optional tab replacement, 409 after
      completion, 400 for a non-loopback bind without auth; verify `oneshot` tests incl. "invalid input changes
      nothing"
- [ ] 2.3 `POST /api/v1/fs/check` (`exists, isDir, writable, freeBytes`, nearest-ancestor writability, creates
      nothing); verify tests on temp dirs including a read-only one
- [ ] 2.4 Capability `portTest`, engine dispatch, Transmission `port-test`, rqbit `Unsupported`,
      `POST /api/v1/network/port-test`; verify `cargo test --workspace` and the ignored Transmission test
- [ ] 2.5 `packages/api-client`: `health.setupRequired`, `setup()`, `checkPath()`, `portTest()`, login
      `remember`, typed `locked_out` / `attemptsLeft`; verify `pnpm typecheck`

## 3. Settings page

- [ ] 3.1 `settings/SettingsPage` on `#/settings/<section>` with `SectionRail`, back to the previous view and a
      `Row` primitive (label, description, control, state, capability hint); verify against frame 19 in both
      modes
- [ ] 3.2 `useAutosave`: row classes `instant | engine-restart | apply`, debounced merge-and-PUT, per-row saved
      / error / rollback; verify a `node --test` for the staging reducer and a manual rejected-value check
- [ ] 3.3 Move every existing control into its section (General, Engine, Network, Bandwidth, Queue & seeding,
      Folders, Notifications, Appearance) and add a test that every key of `GET /settings` has a registered row;
      verify under both engines that unsupported rows are visible and disabled
- [ ] 3.4 `RestartBanner`: staged engine-restart changes with before → after text, Later / Restart engine,
      prompt on leaving with pending changes; verify by changing the listen port
- [ ] 3.5 Terminal & security section: bind, port, allowed hosts and auth as an Apply form with the exposure
      warning and `restartRequired` notice; verify enabling auth keeps the session
- [ ] 3.6 Network extras (port test with last-run time, random port), Folders with live path check, Tabs &
      query (reset default tabs, query reference card), About (version, update check, engine + capabilities);
      verify each manually
- [ ] 3.7 Settings search across sections with jump-to-row highlight; verify `proxy` finds the proxy rows
- [ ] 3.8 Delete the modal `Settings.tsx` and route the settings command / shortcut to the page; verify
      `pnpm lint` and `pnpm typecheck`

## 4. Login

- [ ] 4.1 Rewrite `Login.tsx`: idle, invalid (attempts left, password kept), locked out (live countdown from
      `retryAfterSecs`), session expired; remember checkbox; reset-command hint; plain-HTTP notice for
      non-loopback hosts; verify against frame 20 with auth enabled
- [ ] 4.2 `App.tsx`: remember the hash route on 401 and return to it after login; verify from a torrent
      section address

## 5. First-run setup

- [ ] 5.1 `setup/SetupWizard` shown when `setupRequired`: step indicator, Back / Continue / Skip, state kept
      client-side until the final POST; verify abandoning on step 2 changes nothing on the server
- [ ] 5.2 Engine step (rqbit or Transmission with the existing connection test) and Library step (folder with
      live check and free space, move-completed folder, starting-tab checklist with queries); verify against
      frame 18 and with an unwritable folder
- [ ] 5.3 Access step (loopback only, or network with required password) and completion → main window; verify
      Skip and a full run, and that an upgraded config never shows the wizard

## 6. Wrap-up

- [ ] 6.1 i18n keys in all six dictionaries, `.changeset/` entry, `CLAUDE.md` (settings page, setup state,
      lockout, `auth reset`); verify `pnpm lint`, `pnpm typecheck`, `pnpm test` and `cargo test --workspace`
