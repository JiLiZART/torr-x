## 1. Server: targets and duty

- [ ] 1.1 `crates/torrentx-core`: `Torrent` gains `seedTarget` (effective + `override` flag), `seededSecs:
      Option<u64>`, `duty` enum; update drift fixture and `packages/api-client` together; verify
      `cargo test -p torrentx-core` and the fixture check pass
- [ ] 1.2 `store.rs`: per-torrent `SeedTarget` map and `seeded_secs` counter map, v3→v4 migration; verify a
      v3 fixture loads with empty maps and counters survive a save/load round-trip
- [ ] 1.3 `policy.rs`: `plan()` takes effective targets; accumulate seeding seconds for engines that don't
      report them; verify pure tests: override ratio stops at 2.0 while global is 1.0, `{}` override never
      stops, time-based stop fires from the accumulated counter
- [ ] 1.4 `api.rs`: `PUT /torrents/{id}/seed-target` with validation (finite, ≥ 0), `null` body resets to
      inherit; verify tower `oneshot` tests for set/reset/validation and that `GET /torrents` returns the
      effective target with `override: true`
- [ ] 1.5 `attention.rs`: `seedingDuty`/`done` classification uses the effective target and `duty` derivation;
      verify the existing attention tests still pass plus a per-torrent-override case
- [ ] 1.6 Verify `cargo test --workspace` passes

## 2. Query and UI

- [ ] 2.1 `packages/query`: `duty:` field (`pending | fulfilled | none`); verify `node --test` filtering cases
- [ ] 2.2 Obligation line in the detail hero and the row's secondary text: "keep seeding — 2.3 days left",
      "ratio 1.1 / 2.0", "free to remove", with the "(tracked by TorrentX)" note when the counter is the
      source; verify against a running server with a time-target torrent on rqbit
- [ ] 2.3 Target editor popover (hero + row menu): ratio/time inputs, inherit reset, live preview sentence,
      one `PUT` with inline confirmation; verify the override persists across reload and the policy honors it
- [ ] 2.4 `Clear fulfilled` on the seeding-duty/done group header and as the action of a `duty:fulfilled`
      view: confirmation quotes count, total bytes and paths, two buttons Keep files / Delete files, typed
      confirmation for deletion, per-torrent progress and error reporting; verify manually with three
      fulfilled torrents that Keep files leaves data on disk and Delete files reports the freed bytes
- [ ] 2.5 i18n keys in all six dictionaries; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 3. Docs

- [ ] 3.1 Update `CLAUDE.md` (policy: per-torrent targets, seeding-time accumulation) and the settings
      "Queue & seeding" section copy to mention per-torrent overrides; verify text matches behavior
