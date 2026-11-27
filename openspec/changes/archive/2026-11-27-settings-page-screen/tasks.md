## 1. Server

- [x] 1.1 `api.rs` `POST /network/port-test`; Transmission `port-test` RPC, rqbit `Unsupported`; `portTest`
      capability key; verify tower `oneshot` tests incl. 501 and capabilities entry
- [x] 1.2 Verify `cargo test --workspace` passes
- [x] 1.3 Data screen 19 needs: `network.encryption` setting (`preferred|required|tolerated`, Transmission
      `encryption`, rqbit unsupported) with `encryption` capability key; `Capabilities.version` (librqbit crate,
      Transmission daemon `version`); `dhtNodes` in `GET /stats` (rqbit routing tables, null on Transmission)

## 2. Page shell

- [x] 2.1 `SettingsPage`, `SectionRail`, breadcrumb with ⌘[ back, `settings/<section>` addresses and
      `tx://settings/<section>` deep links; remove modal `Settings.tsx` and its Save button; verify reload
      on Network reopens Network and back returns to the originating tab
- [x] 2.2 Row registry + search (⌘F) listing hits with section, jumping to the row; verify `proxy` finds the
      proxy rows
- [x] 2.3 `Row` + `useAutosave`: per-row saved confirmation, error revert, other rows unaffected; verify a
      rejected value reverts only that row

## 3. Staged changes

- [x] 3.1 `RestartBanner` naming each pending change with Later / Restart engine, leave guard; verify port
      change keeps the old port until restart
- [x] 3.2 Explicit Apply for auth/bind/allowed hosts with the exposure warning; verify enabling auth keeps the
      session

## 4. Sections

- [x] 4.1 Engine header (name, version, mode, capabilities note) and Test connection for Transmission
- [x] 4.2 Network per screen 19: port + chip + Random, UPnP, reachability row, DHT/PeX/LPD, encryption, proxy
      with unsupported rows disabled; verify against rqbit that HTTP/SOCKS4 show "not supported by rqbit"
- [x] 4.3 Remaining sections (General, Bandwidth, Queue & seeding, Folders, Tabs & query, Terminal & security,
      Notifications, Appearance, About) on the same Row pattern; verify every existing setting is reachable
- [x] 4.4 i18n keys in all six dictionaries; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass; manual
      check of screen 19 dark and light
