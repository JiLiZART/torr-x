## 1. Server

- [ ] 1.1 `torrentx-core`: `FileHit {torrent_id, torrent_name, index, path, size, progress, wanted, priority}`;
      mirror in `packages/api-client` (`FileHit`, `api.files()`); verify `cargo test -p torrentx-core` and
      `pnpm typecheck`
- [ ] 1.2 Engine method `files_all()`: rqbit from the session, Transmission with one `torrent-get`
      (`hashString`, `files`, `fileStats`); dispatch in `engine.rs`; verify a Transmission fixture test asserts a
      single RPC call and the rqbit path skips torrents without metadata
- [ ] 1.3 `GET /api/v1/files` in `api.rs`: join decorated names from `list()`, flatten in list and file order,
      `engine_unavailable` like the list; verify tower `oneshot` tests for the three `http-api` scenarios
      (all files, unresolved magnet, renamed torrent) and that it sits behind the auth guard
- [ ] 1.4 Verify `cargo test --workspace` passes

## 2. Query and pure logic

- [ ] 2.1 `@torrentx/query`: `FILE_SEARCH_SCOPE` (file scope + `torrent` text field); verify `node --test` for
      `torrent:expanse ext:mkv` and the unknown-field error listing file-search fields
- [ ] 2.2 `lib/palette.ts`: chip stack (`command`, `files`, `torrentPending`, `torrent`), `onInput`,
      `onBackspaceEmpty`, `pickTorrent`, start-scoped on a detail page, `detectMode` for `files` and
      `pickTorrent`; verify tests for `@␣`, `foo @`, `torrent:␣`, `torrent:ubuntu` (no picker), Backspace pops in
      order, detail-page start
- [ ] 2.3 `trimMiddle(name, max)` in `lib/format.ts` keeping extension and `SxxEyy`; verify tests for a long scene
      name, no extension, short name, and an episode code near the end
- [ ] 2.4 File hit ranking: evaluate, rank by bare words on the name, scoped empty query keeps file order, cap 50
      with the remaining count; verify tests

## 3. Palette UI

- [ ] 3.1 Mode chips in the palette input (`files`, `torrent: <name>`, pending `torrent:`), placeholder and hint
      per mode, Backspace-on-empty behavior; verify manually in `pnpm dev:web` against the `Palette file mode`
      scenarios
- [ ] 3.2 Fetch `api.files()` on entering file mode with the palette's loading line; empty-query hint; "N more"
      line; verify with a library of several torrents that results appear after one request (network tab)
- [ ] 3.3 Torrent picker results (all torrents ranked by name), `⏎` turns the pending chip into a scope chip and
      clears the input; scoped empty query lists the torrent's files; verify the `Torrent scope picker` scenarios
- [ ] 3.4 Opening the palette on a detail page pre-adds the torrent chip when entering file mode; verify the
      `File mode starts scoped on a torrent page` scenarios

## 4. Rows and navigation

- [ ] 4.1 Extract `FileRowCells` from `FilesSection` with a `compact` variant (icon, trimmed name, optional
      torrent name, size, done bar, priority word, no actions, one fixed height); `FilesSection` uses the full
      variant; verify the Files section renders unchanged and compact rows never wrap at the palette width
- [ ] 4.2 `⏎`/click on a hit: navigate to `#/torrent/<id>/files`, `focusFile` in `App.tsx`, scroll + 2 s highlight
      in `FilesSection`, lens and Files filter unchanged, back returns; verify the `Open a file result` scenarios
- [ ] 4.3 Register `@` and `torrent:` hints in the shortcut sheet; i18n keys in all six dictionaries; verify
      `pnpm lint`, `pnpm typecheck` and `pnpm test` pass

## 5. Docs and release

- [ ] 5.1 Update `CLAUDE.md` (palette chips, `GET /files`, file-search scope, the `GET /files` size ceiling under
      Known Gaps); verify the text matches the implementation
- [ ] 5.2 Add a `.changeset/` file (`minor`, palette file search); verify the CI `changes` job accepts it
