## 1. Server

- [ ] 1.1 `crates/torrentx-core`: `AddOptions.added_by: Option<String>`, `Torrent.added_by: Option<String>`;
      update drift fixture and `packages/api-client` together; verify `cargo test -p torrentx-core` and the
      fixture check pass
- [ ] 1.2 `api.rs`: `GET /fs/free?path=` resolving the nearest existing ancestor, returning
      `{freeBytes, totalBytes, path}`; reject relative/traversal paths with `invalid_input`; verify tower
      `oneshot` tests for an existing dir, a not-yet-existing subfolder, and a rejected path
- [ ] 1.3 Add route: normalize `addedBy` (trim, ≤ 64 chars), default unnamed API adds to `api`, persist in
      `store.rs` keyed by id; verify tests: UI-labeled add returns `you`, unlabeled API add returns `api`,
      provenance survives a store reload
- [ ] 1.4 Verify `cargo test --workspace` passes

## 2. Query and add flow

- [ ] 2.1 `packages/query`: `by` field (text, wildcards, `unknown` for null); verify `node --test` cases for
      `by:sonarr`, `by:!you`, `by:unknown`
- [ ] 2.2 Add flow fit warning: fetch `/fs/free` for the chosen path, compare against checked-file total,
      show "needs X, Y free on <path>" when short, recompute on check/path changes, never block the add,
      no warning while magnet metadata is pending; verify manually with a save path on a small volume
- [ ] 2.3 The add flow sends `addedBy: "you"`; verify an add from the UI lists as `you` and a `curl` add
      lists as `api`

## 3. Provenance in the list

- [ ] 3.1 "Added by" column at the lowest adaptive tier with robot glyph for non-`you` values, value also in
      the detail hero; verify it hides first at narrow widths and the header hides with it
- [ ] 3.2 Palette/Spotlight entry "Added by automation" jumping to `by:!you added:<24h`; verify it opens the
      tab view with that lens and does not save a tab
- [ ] 3.3 i18n keys in all six dictionaries; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 4. Docs

- [ ] 4.1 Document `addedBy` for API clients (Sonarr/Radarr setup hint) in the http-api spec notes and
      `CLAUDE.md` key design points; verify text matches behavior
