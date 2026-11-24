## Context

See proposal.md for why. Current shape:

- `AppState.engine: RwLock<Result<Arc<Engine>, String>>`, filled from `config.engine` (`kind` + `rqbit` +
  `transmission` sections). `restart_engine` swaps the whole slot on any engine settings change.
- `Engine` is an enum over `RqbitEngine` and `TransmissionEngine` with inherent async methods, dispatched by a
  `dispatch!` macro (`crates/torrentx-server/src/engine.rs`).
- Engines return bare info-hash ids. `api::decorate` adds tags, rename overrides and queue state from
  `store.rs` (`state.json` v3), all keyed by bare hash.
- `policy.rs` (5 s tick) and `stats.rs` call `api::engine(&state)` and work on one list.
- `@torrentx/query` reads a `Row`; tabs are saved queries (`active-tab-screen`).

## Goals / Non-Goals

**Goals:**
- N engines live at once with independent lifecycles and failures.
- Keep the enum dispatch; adding qBittorrent is one more variant and one more crate.
- Keep the UI on the HTTP API only; provider awareness arrives as data (`provider` on torrents,
  `GET /providers`).

**Non-Goals:**
- A trait-object plugin system or dynamically loaded providers.
- Cross-provider operations (move a torrent between providers, merge duplicate rows).
- Per-provider network/advanced settings screens (one global set, pushed to the providers that opt in).

## Decisions

### Provider map instead of one slot
`AppState.providers: RwLock<Vec<ProviderSlot>>` where `ProviderSlot { cfg: ProviderConfig, engine:
Result<Arc<Engine>, String> }`, kept in config order. Lookup by id is a linear scan (a handful of providers).
Lifecycle operations (`start_provider`, `stop_provider`, `restart_provider`) touch one slot; the write lock is
held only to swap the `Arc`, so slow starts (rqbit session load) happen outside the lock and are installed
afterwards.
- *Alternative*: `HashMap<String, Slot>` — loses the user's order for free; not needed at this size.
- *Alternative*: one `RwLock` per slot — unnecessary until providers are edited concurrently.

### Scoped id handled at the server edge
Engines keep speaking bare info-hashes; they do not know their provider id. The server prefixes on the way out
(`list`, `get`, `add` results, events) and splits on the way in. One helper in `torrentx-core`:
`TorrentId { provider, info_hash }` with `parse` (accepts `p:hash` and bare `hash`) and `Display`.
`Torrent` gains `provider` and `info_hash`; `id` is set by the server. A bare hash in a path is resolved by
asking each enabled provider's cached last list (see below), never by calling every daemon.
- *Alternative*: engines produce scoped ids themselves — every engine crate would need the provider id and
  tests would change for no gain.
- Separator `:` is safe: ids are `[a-z0-9-]`, hashes are hex, and `:` is legal in a URL path segment.

### Fan-out list with a per-provider budget and cache
`GET /torrents` calls `list()` on all running providers concurrently (`join_all`), each wrapped in
`tokio::time::timeout(5s)`. Each slot keeps its last successful list (`Mutex<Arc<Vec<Torrent>>>` + time) for
bare-hash resolution and for `torrentCount`. A timeout or error marks the provider `unavailable` with the
message; the next success clears it. The list response stays a plain array (no envelope) to keep scripts
working; availability comes from `GET /providers`, which the UI polls with the list.
- *Alternative*: envelope `{torrents, unavailable}` — cleaner single round trip, but breaks every client.

### qBittorrent crate mirrors the Transmission crate
`crates/torrentx-qbittorrent`: `QbittorrentEngine` with the same inherent method set, `reqwest` with a cookie
jar, login on first call and again once on 403, `GET /api/v2/app/webapiVersion` at start to pick
`stop/start` (≥ 2.11) vs `pause/resume`, and gate `torrents/export` (≥ 2.8.14). Mapping:

| TorrentX | Web API v2 |
|---|---|
| list | `torrents/info` |
| get | `torrents/properties` + `torrents/files` + `torrents/trackers` |
| add | `torrents/add` (`urls` or multipart `torrents`, `savepath`, `stopped`/`paused`, `root_folder`/`contentLayout`) |
| pause / resume | `torrents/stop` / `start` or `pause` / `resume` |
| remove | `torrents/delete` (`deleteFiles`) |
| peers | `sync/torrentPeers` |
| pieces | `torrents/pieceStates` |
| verify / relocate / rename | `torrents/recheck` / `setLocation` / `rename` |
| add_tracker | `torrents/addTrackers` |
| set_files | `torrents/filePrio` (0 skip, 1 low, 6 normal, 7 high) |
| torrent_file | `torrents/export` |
| apply_settings | `app/setPreferences` (only with `manageSettings`) |
| session_totals | `transfer/info` |

`preview` returns `Unsupported`; the add flow then skips the file picker for that provider, like Transmission
today. Hashes: v1 info-hash (`hash` / `infohash_v1`); hybrid/v2-only torrents use the field qBittorrent reports
as `hash`.

### Config: `[[providers]]` array, migration from `[engine]`
```toml
default_provider = "rqbit"

[[providers]]
id = "rqbit"
name = "This computer"
kind = "rqbit"
enabled = true
download_dir = "/home/u/Downloads/TorrentX"

[[providers]]
id = "nas"
name = "NAS"
kind = "transmission"
enabled = true
manage_settings = false
host = "nas"
port = 9091
path = "/transmission/rpc"
username = ""
password = ""
```
`ProviderConfig` is `{id, name, enabled, manage_settings, kind: ProviderKind}` where `ProviderKind` is a
`#[serde(tag = "kind")]` enum carrying `RqbitConfig`, `TransmissionConfig` or `QbittorrentConfig`. Migration
runs before validation in the existing v1 hook: `[engine]` present → build providers as specified, drop
`[engine]`, write back. Validation adds: unique ids, id charset, exactly one `rqbit`, default is enabled, at
least one enabled. rqbit data stays at `<data_dir>/rqbit` (one built-in instance, so no per-id directory).

### State v4: provider-scoped keys
`state.json` maps (`tags`, `names`, `policy`) move from `hash` keys to `provider:hash` keys. The v3 → v4 step
needs the provider that was active, so `Store::open` takes the migrated config's former engine kind
(`rqbit` or `transmission`) as the prefix. Deleting a provider drops its keys. `GRAMMAR_VERSION` is unchanged:
`provider:` is a new field, not a grammar change.

### Settings pushed to managed providers only
`apply_settings(tuning)` is called for the built-in provider and every provider with `manage_settings`. The
migrated Transmission provider gets `manage_settings = true` to keep today's behavior; user-added ones default
to false so a shared daemon is not reconfigured by surprise. The settings screen computes control support as
the union over receiving providers (see `engine-capabilities`).

### Policy and stats per provider
`policy.rs` loops over running providers, building `plan()` input per provider with that provider's
capabilities; `plan()` itself is unchanged (pure, already tested), which makes queue limits per provider for
free. Events carry the scoped id. `stats.rs` sums session totals over running providers; free space stays the
built-in download directory's.

### UI
- `api-client`: `Provider`, `ProviderStatus`, `Torrent.provider`, `Torrent.infoHash`; settings types.
- `@torrentx/query`: `provider: "exact"` in `FIELDS`, `Row.provider`; completion values come from the
  `values` callback (already used for tags/trackers).
- `packages/ui`: `useProviders()` polled with the list; `ProviderGlyph` (three inline SVG glyphs keyed by kind,
  `currentColor`, theme tokens); glyph rendered in `TorrentRow` only when `enabledProviders > 1`; Providers
  settings section; provider picker in the add flow; partial-availability banner next to the existing
  `engine_unavailable` banner. Capability lookups switch from one global matrix to `capsFor(torrent.provider)`.

## Risks / Trade-offs

- [Scoped ids break scripts and stored addresses] → bare-hash resolution keeps single-provider setups working
  unchanged; changeset marks it breaking; addresses with a bare hash resolve the same way.
- [Slow daemon makes the list feel slow] → 5 s per-provider budget, concurrent fan-out; a slow provider is
  reported unavailable rather than blocking. If 5 s proves long, lower it; the UI keeps showing the previous list
  meanwhile.
- [Duplicate info-hash rows confuse users] → glyph shows provider; details name it; this is the explicit choice
  over silent de-duplication.
- [qBittorrent API drift across 4.x/5.x] → version probe at start, feature gates in capabilities, a mock-server
  unit test per mapping, and an `--ignored` integration test against a real `qbittorrent-nox` like the
  Transmission one.
- [Migration bug loses tags] → migration is pure and unit-tested on v1/v2/v3 fixtures; the old `state.json` is
  copied to `state.v3.json` before the first v4 write.
- [Passwords for several daemons in the config file] → same as today: plaintext in a 0600 file, never returned by
  the API (`hasPassword` only).

## Migration Plan

1. On first start of the new version: config `[engine]` → `[[providers]]`, `state.json` v3 → v4 (backup kept),
   both written back.
2. Rollback: restore the previous binary plus `config.toml` from the user's backup and `state.v3.json` →
   `state.json`; the previous version does not read `[[providers]]`.
3. Desktop attach mode is unaffected (`/health` keeps `app` and `engine`).
