## 1. Model and ids

- [ ] 1.1 `torrentx-core`: `TorrentId {provider, info_hash}` with `parse` (scoped and bare) and `Display`;
      `Torrent.provider` and `Torrent.info_hash`; verify unit tests for `nas:ab12…`, bare hash, bad charset
- [ ] 1.2 Update the drift fixture `tests/fixtures/torrent.json` and `packages/api-client` types (`Torrent`,
      `Provider`, `ProviderStatus`, settings) together; verify `cargo test -p torrentx-core` and
      `packages/api-client/src/fixture.check.ts` pass

## 2. Config and state migration

- [ ] 2.1 `config.rs`: `ProviderConfig` + tagged `ProviderKind` (rqbit / transmission / qbittorrent),
      `default_provider`, validation (unique ids, id charset, one `rqbit`, default enabled, ≥1 enabled); verify
      unit tests for each rejection
- [ ] 2.2 `[engine]` → `[[providers]]` migration (rqbit-only and transmission configs, incl. v1 `url`), written
      back; verify tests on v1 and single-engine fixtures match the `torrent-providers` migration scenarios
- [ ] 2.3 `store.rs` state v4: keys scoped by provider, v3 → v4 with the former engine as prefix, `state.v3.json`
      backup, drop keys on provider delete; verify migration and delete tests

## 3. Provider runtime

- [ ] 3.1 `lib.rs`: provider map replacing the single slot; start/stop/restart one provider outside the write
      lock; graceful shutdown of all; verify a test that restarting one provider leaves another's `Arc` intact
- [ ] 3.2 `api.rs`: fan-out `list` with 5 s per-provider timeout, last-list cache, `unavailable` status,
      `engine_unavailable` only when all are down; scoped-id prefixing in `list`/`get`/`add`/events; verify
      tower `oneshot` tests with a stub provider that hangs and one that errors
- [ ] 3.3 Id resolution for every `/torrents/{id}` route (scoped, bare unique, bare ambiguous → `invalid_input`
      listing ids, unknown → `not_found`); add target `provider` + per-provider `duplicate`; verify API tests
      for each `torrent-providers` id scenario
- [ ] 3.4 `/providers` routes (GET/POST/PATCH/DELETE) and `/providers/test`; `/transmission/test` → 410;
      `PUT /settings` with `providers`/`defaultProvider`, kept passwords; `/capabilities?provider=`; `/health`
      `engine` = default kind; `reveal` only for the built-in provider; verify API tests incl. built-in delete,
      last-enabled disable, default reassignment on delete and no password in any response
- [ ] 3.5 `policy.rs` per provider (queue counted per provider, seeding/move-completed everywhere, skip
      unavailable) and `stats.rs` summed totals; settings pushed only to built-in + `manage_settings`; verify
      `plan()` tests still pass plus a test that two providers' queues are independent
- [ ] 3.6 Verify `cargo test --workspace` passes

## 4. qBittorrent engine

- [ ] 4.1 `crates/torrentx-qbittorrent`: client with cookie login, re-login once on 403, Web API version probe,
      stop/start vs pause/resume; verify unit tests against a local mock HTTP server for login renewal and both
      API generations
- [ ] 4.2 Operations per the design mapping table, status mapping, capability matrix gated by API version,
      `preview` → `Unsupported`; verify mock-server tests for status mapping (`stalledUP` → `seeding`, `moving` →
      `checking`, `missingFiles` → `error`) and `filePrio` values
- [ ] 4.3 `Engine::Qbittorrent` variant and wiring in `engine.rs`; `--ignored` integration test with
      `TORRENTX_TEST_QBITTORRENT` (add magnet, pause, resume, remove); verify it passes against a local
      `qbittorrent-nox`
- [ ] 4.4 Verify `cargo test --workspace` and `cargo clippy --workspace` pass

## 5. Query and tabs

- [ ] 5.1 `@torrentx/query`: `provider: "exact"` field, `Row.provider`, `sort:provider`, completion values from
      the provider list; verify `node --test` cases for `provider:nas`, `provider:!rqbit`, unknown id matches
      nothing, completion
- [ ] 5.2 "Create tab" for a provider (query `provider:<id>`, named after it, not activated, activates an
      existing identical tab instead); verify manually and with a pure test of the dedupe helper

## 6. UI

- [ ] 6.1 `useProviders()` polled with the list; capability lookups switch to the torrent's provider; verify
      per-file priority enables for a qBittorrent torrent and disables for an rqbit one
- [ ] 6.2 `ProviderGlyph` (rqbit / transmission / qbittorrent, monochrome, theme tokens) in `TorrentRow`, shown
      only with >1 enabled provider; click adds `provider:<id>` chip; menu "Create tab"; details name the
      provider; verify rows are unchanged with one provider and the chip is added on click
- [ ] 6.3 Providers settings section (list, status, add/edit with test, enable/disable, default, create tab,
      delete confirm, built-in rules); verify adding, testing and deleting a Transmission provider in
      `pnpm dev:web`
- [ ] 6.4 Add flow provider picker (default preselected, hidden with one provider, options and free space follow
      the pick, disabled when the pick already has the hash); verify adding the same magnet to two providers
- [ ] 6.5 Partial-availability banner naming unavailable providers with errors and a settings link; verify by
      stopping a Transmission daemon while rqbit runs and starting it again
- [ ] 6.6 i18n keys in all six dictionaries; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 7. Docs and release

- [ ] 7.1 Update `CLAUDE.md` (providers, scoped ids, qBittorrent crate, test command) and the id invariant in
      `openspec/config.yaml`; verify the text matches the implementation
- [ ] 7.2 Add a `.changeset/` file (`major`, breaking ids and settings shape, qBittorrent support); verify the CI
      `changes` job accepts it
