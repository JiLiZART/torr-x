## Why

Screen 19 (`pen/untitled.pen`, `pETNK` "Settings — full page (not a modal)") makes settings a place you can
link to, search, and leave half-way: a section rail, per-section addresses, auto-saving rows that explain
themselves, and a restart banner that says exactly what changed. Today settings is a modal with one Save
button — none of that is possible. This change implements the screen from the ground up, replacing the
settings portion of the removed board-derived `setup-settings-page-and-login` change.

## What Changes

- **Settings is a page**: breadcrumb `← <tab> ⌘[` / Settings / `<section>`; each section has its own address
  and deep link (`tx://settings/network`); ⌘[ returns to the tab the user came from. **BREAKING (UI)**: the
  settings modal and its Save button are removed.
- **Section rail + search** as drawn: General, Engine, Network, Bandwidth, Queue & seeding, Folders,
  Tabs & query, Terminal & security, Notifications, Appearance, About; "Search settings ⌘F" filters rows
  across sections.
- **Changes save automatically**, one control at a time, with inline confirmation and inline errors; the
  page header states "changes save automatically".
- **Restart-required banner**: staged engine/restart changes show what changed ("The listen port changed
  from 6881 to 51413. Transfers keep running on the old port until the engine restarts.") with *Later* /
  *Restart engine*; credentials and exposure changes need an explicit Apply.
- **Honest rows**: every row has a one-line explanation; group captions state scope ("restart required for
  port changes", "how new peers are found", "applies to new connections only", "rqbit · SOCKS5 only");
  unsupported rows stay visible and disabled with "not supported by <engine>" (HTTP/SOCKS4 proxy as drawn).
  Engine header shows version + "capabilities drive which rows below are available".
- **Network section specifics**: incoming port with state chip (`open`) and *Random* action; UPnP/NAT-PMP
  toggle; **Port reachability** row with last-checked age, result chip and *Test again*, backed by a new
  `POST /network/port-test` and the `portTest` capability; DHT (with node count), PeX, LPD toggles;
  encryption mode select; SOCKS5 proxy type/address.
- **Server**: port-test endpoint (501 where the engine cannot test); `portTest` capability key.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: "Settings screen" — modal → page, auto-save, restart banner, search, honest rows, port test.
- `http-api`: adds "Port test endpoint".
- `engine-capabilities`: adds "Port test capability".

## Impact

- `packages/ui`: `Settings.tsx` (modal) replaced by `settings/` (`SettingsPage`, `SectionRail`, `Row`,
  `RestartBanner`, one file per section, `useAutosave`); `App.tsx` routes `settings/<section>`; i18n keys in
  six dictionaries.
- `packages/api-client`: `portTest()`, capability type.
- `crates/torrentx-server`: `api.rs` `/network/port-test`; engine dispatch; `crates/torrentx-transmission`
  port-test RPC; `crates/torrentx-rqbit` `Unsupported`.
- Depends on `active-tab-screen` (shell, addresses, back) and `add-flow-and-theming` (tokens, appearance
  section consumes `appearance`). The wizard (`empty-library-and-first-run`) links here for everything it
  skips.
