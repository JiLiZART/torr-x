## Why

TorrentX runs exactly one engine at a time: rqbit in-process or one Transmission daemon, switched in settings.
People who seed from a NAS, a seedbox and their laptop have to run several clients and several UIs. One
TorrentX should show and control all of them in one list, with the same query language, tags and tabs.

## What Changes

- **Providers**: the single engine slot becomes a list of providers. A provider is a named, configured engine
  instance `{id, name, kind, enabled, connection}`. The built-in rqbit provider (`id: rqbit`) always exists and
  cannot be deleted (it can be disabled). Any number of remote providers can be added, including several of the
  same kind. One provider is the default target for new torrents.
- **qBittorrent provider**: a new engine crate `torrentx-qbittorrent` controls `qbittorrent-nox` / qBittorrent
  through its Web API v2 (4.1+ and 5.x), next to rqbit and Transmission.
- **BREAKING: scoped torrent ids**: a torrent id becomes `<providerId>:<infoHash>` (e.g. `nas:ab12…`), so the
  same torrent can be seeded by two providers. Every torrent also carries `provider` and `infoHash`. A bare
  info-hash in an API path still resolves when exactly one provider has it.
- **BREAKING: settings shape**: the `engine` settings section is replaced by `providers` + `defaultProvider`.
  Old config files (`[engine]` with `kind = rqbit|transmission`) and `state.json` keys migrate on load.
- **Provider endpoints**: `GET/POST /providers`, `PATCH/DELETE /providers/{id}`, `POST /providers/test`
  (replaces `POST /transmission/test`). Each provider reports its status and its own capability matrix.
- **Isolation**: a provider that is down or slow does not block the others. The list shows what the reachable
  providers report; the UI names the unreachable ones in a banner. `engine_unavailable` is returned only
  when every enabled provider is down.
- **Add target**: `POST /torrents` takes an optional `provider`; the add flow gets a provider picker defaulting
  to the default provider.
- **Torrent list**: each row shows a provider glyph (by kind) with the provider name on hover, whenever more
  than one provider is enabled. Clicking it adds `provider:<id>` to the lens.
- **Query**: new `provider:` field (exact match on provider id, completion from the provider list).
- **Provider tabs**: a tab containing one provider's torrents is a tab whose query is `provider:<id>`. Settings
  → Providers offers "Create tab" per provider.
- **Server policy and stats** run across all providers: queue limits count per provider, seeding limits and
  move-completed apply to every provider, session totals are summed.

## Capabilities

### New Capabilities
- `torrent-providers`: provider registry, built-in rqbit provider, remote providers, default provider,
  scoped ids, availability isolation, config and state migration.

### Modified Capabilities
- `torrent-engine`: torrent model gains `provider` and `infoHash`, ids become scoped; adds the qBittorrent
  engine.
- `engine-capabilities`: capabilities are reported per provider; controls follow the torrent's provider.
- `http-api`: health, torrent endpoints (scoped ids, add target), settings (`providers` replaces `engine`),
  extended endpoints (`/providers/test` replaces `/transmission/test`), stats and capabilities, new provider
  endpoints.
- `headless-server`: default config holds the built-in provider; a failing provider does not stop the server
  or the other providers.
- `torrent-query`: adds the `provider:` field.
- `torrent-tabs`: adds provider tabs.
- `web-ui`: Providers settings section, provider glyph in the list, add target picker, partial-availability
  banner.

## Impact

- **Crates**: new `crates/torrentx-qbittorrent` (reqwest, cookie session). `torrentx-core`: `Torrent.provider`,
  `Torrent.info_hash`, id helpers. `torrentx-server`: `config.rs` (providers + v2 migration), `lib.rs` (engine
  slot → provider map), `engine.rs` (third variant), `api.rs` (id resolution, fan-out list, provider routes),
  `store.rs` (state v4: keys scoped by provider), `policy.rs` and `stats.rs` (per provider).
- **TS**: `packages/api-client` types (`Provider`, `Torrent.provider/infoHash`, settings), drift fixture,
  `packages/query` (`provider` field), `packages/ui` (settings section, row glyph, add picker, banner, i18n in
  six dictionaries).
- **Docs**: `CLAUDE.md` and `openspec/config.yaml` invariant "Torrent id = lowercase hex info-hash" becomes
  "`<providerId>:<infoHash>`".
- **Depends on** `active-tab-screen` (query language, tags, tabs as saved queries) being archived first: this
  change modifies its `Torrent endpoints` and `Torrent list` versions and adds to its `torrent-query` and
  `torrent-tabs` specs. `settings-page-screen` should host the Providers section in its section rail.
- **Non-goals**: moving a torrent between providers; per-provider network/advanced tuning screens (remote
  daemons keep their own settings unless the provider opts in to TorrentX-managed settings); Deluge, rTorrent,
  aria2; provider accent colors.
