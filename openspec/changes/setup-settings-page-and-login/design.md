## Context

- `Settings.tsx` is a `Modal` with sections General, Network, Downloads, Remote, Appearance, Advanced, Server and
  one Save button; it GETs and PUTs the whole settings object. `PUT /settings` restarts the engine live when
  engine-affecting fields change and returns `restartRequired` for bind/port changes.
- `auth.rs`: sessions are an in-memory map with a 30-day TTL and a 30-day cookie for every login; there is no
  attempt limiting. `login` returns 401 on a wrong password. The desktop window logs in with a one-time handoff
  token and never shows the login form.
- A fresh server writes a default config and starts; nothing distinguishes "never configured" from "configured
  with defaults". The server binary has flags (`--config`, `--bind`, `--port`) but no subcommands.
- Invariant: the UI uses Tauri IPC for window controls only — there is no native folder picker available to it.
- Source frames: 18 (setup, step 2 shown), 19 (settings, Network shown), 20 (login + state list).

## Goals / Non-Goals

**Goals:** settings as an addressable, searchable, auto-saving page; a skippable first-run setup that makes the
three consequential defaults visible; a login screen whose every state is designed; brute-force resistance for
the password.

**Non-Goals:** a native folder picker ("Browse…" in the frames) — paths are typed and validated; multi-user
accounts or roles; TLS termination (the login only tells the user the connection is plain HTTP); persisting
sessions across server restarts; a settings import/export; user-rebindable shortcuts; re-running setup from the
UI (everything it sets is in Settings).

## Decisions

1. **Settings route and layout.** `#/settings/<section>`; the page renders inside the shell (sidebar stays),
   with a section rail + search on the left and the section's groups on the right. Back uses the shell history.
   Section mapping from the old modal: General → General + Notifications; Network → Network (connection, peer
   discovery, encryption, proxy) + Bandwidth; Downloads → Folders + Queue & seeding; Remote → Engine; Appearance
   → Appearance; Advanced → split into the sections its rows belong to; Server → Terminal & security (bind,
   port, allowed hosts, auth, the statement that no remote shell exists) ; About is new (version, update check,
   engine + capabilities). "Tabs & query" holds reset-to-default tabs and the query reference card.
2. **Auto-save with three classes of rows.** Each row declares `apply: "instant" | "engine-restart" | "apply"`.
   - *instant*: debounced `PUT /settings` with just that change merged into the last known settings; the row
     shows saved / failed inline and rolls back on error.
   - *engine-restart* (listen port, engine kind, Transmission connection, proxy…): staged client-side; a banner
     lists the staged changes ("listen port 6881 → 51413") with *Later* and *Restart engine*; the PUT — which
     is what restarts the engine — is sent on *Restart engine*. Staged values survive section switches and are
     dropped, with a prompt, when leaving settings.
   - *apply* (auth on/off, username, password, bind address, port, allowed hosts): edited as a small form with
     an explicit Apply, because a half-typed password or address must never be sent. The existing
     exposed-without-auth warning and `restartRequired` notice live here.
   No server change is needed: the server already applies whatever it is sent. *Alt:* a server-side "pending
   restart" state — rejected, it adds a second source of truth for the same values.
3. **Search** filters rows across all sections by label, description and i18n keywords and shows matches grouped
   by section; choosing one navigates to its section and highlights the row.
4. **Port test.** `POST /api/v1/network/port-test` → `{open: true|false|null}` delegates to the engine:
   Transmission's `port-test`; rqbit has none → 501 and capability `portTest: unsupported`, row disabled with
   the hint. It runs only on an explicit click (it contacts a third-party tester through the engine) and the row
   shows when it was last run. "Random" picks a port in 49152–65535 client-side and stages it.
5. **Setup state lives in the config file.** `setup_completed: bool`. A config file created by the server on
   first start gets `false`; a file that exists without the key is read as `true` (so upgrades never see the
   wizard). `GET /health` adds `setupRequired`. `POST /api/v1/setup` accepts `{engine?, downloadDir?,
   moveCompleted?, tabs?: [{name, query, pinned}], access?: {bind, auth?: {username, password}}}`, validates
   everything first, applies it as one settings change, replaces the seeded tabs when `tabs` is given, sets
   `setup_completed` and returns the same shape as `PUT /settings` (incl. `restartRequired`). An empty body
   means "use defaults". It answers 409 once setup is completed. Setup never gates the API: a headless server
   left untouched works with defaults exactly as today.
6. **Setup UI.** Shown instead of the shell when `setupRequired` and the client is allowed to configure
   (auth is off on a fresh server, so the first browser to open it gets it). Steps: *Engine* (embedded rqbit, or
   Transmission connection with the existing test) → *Library* (download folder with live validation, optional
   move-completed folder, a checklist of starting tabs with their queries) → *Access* (loopback only — default —
   or reachable from the network, which requires setting a password in the same step). "Skip — use defaults"
   posts an empty setup. Nothing is sent before the final step.
7. **Path check.** `POST /api/v1/fs/check {path}` → `{exists, isDir, writable, freeBytes}`; used by setup and
   the Folders section so a bad folder is caught while typing rather than on first download. It reveals only
   those four facts and is behind the usual guards.
8. **Login attempts.** Failures are counted per client address (the peer address; no proxy headers are
   trusted): 5 consecutive failures → that address is locked out for 60 s. A failed login returns 401 with
   `attemptsLeft`; while locked out, login and Basic auth from that address return 429 `locked_out` with
   `retryAfterSecs` and a `Retry-After` header, without checking the password. A success resets the counter.
   Counters live in memory and are pruned on a timer. *Alt:* a global lockout — rejected, it lets anyone lock
   the owner out.
9. **Remembered vs. plain sessions.** `POST /auth/login` takes `remember`. `true` → today's behavior (30-day
   sliding TTL, `Max-Age` cookie). `false` → a browser-session cookie (no `Max-Age`) and a 12-hour sliding TTL
   server-side. Sessions stay in memory, so a server restart signs everyone out — unchanged, and stated on the
   screen's hint line only if it becomes a support issue.
10. **Session expiry return path.** On a 401 from any call the UI stores the current hash route, shows the
    login card in its "session expired" state, and navigates back to that route after login. A lens is not
    restored (lenses are never persisted).
11. **`torrentx-server auth reset`.** A `clap` subcommand that loads the config, sets `auth.enabled = false`,
    clears the stored hash and writes it back; it refuses to proceed if the config binds to a non-loopback
    address unless `--force` is given (otherwise it would expose an unauthenticated UI), and tells the user to
    restart the service. The login screen prints the command.

## Risks / Trade-offs

- **Auto-save makes mistakes immediate.** → Risky rows are not instant (classes 2 and 3); instant rows roll
  back visibly on error; nothing destructive is a setting.
- **Staged engine changes can be lost on reload.** → The banner says they are not applied yet; leaving settings
  prompts. Accepted for not adding server state.
- **Lockout per address behind a reverse proxy locks everyone at once.** → Documented; it is still only 60 s,
  and it is the safe failure mode for a single-user tool.
- **A fresh, network-exposed headless server shows the setup to whoever connects first.** → The default bind is
  loopback; exposing it requires editing the config or passing `--bind`, at which point the operator already
  chose. The Access step requires a password to keep a non-loopback bind.
- **Splitting a 574-line modal** risks dropping a control. → A checklist test enumerates every settings key
  returned by `GET /settings` and asserts a row is registered for it.

## Migration Plan

1. Server: attempt limiting, session kinds, `setup_completed`, `/setup`, `/fs/check`, port test, `auth reset`.
2. Settings page on the `settings` route with all existing controls; delete the modal.
3. Login states. 4. Setup wizard (last — it depends on the page for "editable later").
Rollback = revert; `setup_completed` is ignored by older builds.

## Open Questions

- A folder picker: the frames show "Browse…". Assumed out of scope until the Tauri-IPC invariant is revisited
  (a `dialog` permission for the loopback origin) or a server-side directory browser is specced.
