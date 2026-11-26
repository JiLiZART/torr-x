## 1. Model and selection rules

- [x] 1.1 `torrentx-core`: `Torrent.cover` and `FileInfo.cover` (`Option<String>`); update the drift fixture
      `tests/fixtures/torrent.json` and `packages/api-client` types together; verify `cargo test -p
      torrentx-core` and `packages/api-client/src/fixture.check.ts` pass
- [x] 1.2 `torrentx-server/src/covers.rs`: pure `pick_cover(files)` (root `poster.*`, dominant kind, name
      score, size tie-break, SVG and >20 MB excluded) and the per-folder audio variant; verify unit tests for
      the poster, album-art, image-torrent, video-torrent and two-albums cases
- [x] 1.3 Image type from magic bytes (JPEG, PNG, GIF, WebP); verify unit tests incl. a text body and an SVG

## 2. Server

- [x] 2.1 `store.rs`: optional `covers` records (`torrent`, `files`, `removed`, `lookedUp`), dropped with the
      torrent together with `<data_dir>/covers/<id>/`; verify tests that an old `state.json` loads and that
      removal clears the record and the folder
- [x] 2.2 Policy tick sets a local cover when the picked file is complete; `decorate` fills `cover` on
      torrents and files with a version string; verify a test that `cover` stays `null` until the file is done
- [x] 2.3 `api.rs`: `GET` cover routes (content type, `nosniff`, sandbox CSP, immutable cache with `?v=`),
      `PUT /torrents/{id}/files/{index}/cover` (512 KB, type check, promotes to the torrent cover),
      `DELETE` routes with the `removed` flag; verify tower `oneshot` tests for each scenario of "Cover fields
      and image endpoints", "Uploaded video frames" and "Removing a cover"
- [x] 2.4 Verify `cargo test --workspace` and `cargo clippy --workspace` pass

## 3. Online lookup

- [x] 3.1 Check the TMDB search, episode and image endpoints and the attribution rule against the current TMDB
      docs and correct design.md; `config.rs` `[covers]` (`online_lookup`, `api_key`, never returned);
      `covers` in `GET/PUT /settings`; verify an API test that no key text is ever returned
- [x] 3.2 TMDB client on `reqwest` and `POST /torrents/{id}/cover/lookup` (first match, poster or episode
      still, stored result reused, local image wins, `unsupported` when off); verify tests against a local
      mock server incl. an assertion that the outbound request holds only title, year, season and episode
- [x] 3.3 Verify `cargo test --workspace` passes with the lookup off making no outbound request

## 4. UI

- [x] 4.1 `Hero`: cover background with a theme-token overlay, live update, "Remove cover" as a registered
      command; verify contrast in dark and light mode in `pnpm dev:web`
- [x] 4.2 `lib/cover.ts`: frame capture (hidden muted `<video>` on the stream URL, seek to
      `min(duration * 0.03, 60 s)`, canvas to JPEG ≤ 640 px, upload), one at a time, per-session failure memo;
      verify a pure test of the seek-time and queue helpers and a manual capture on an MP4 torrent
- [x] 4.3 Media view thumbnails with placeholders and on-screen loading; lookup requests from the detail page
      using `lib/media.ts` titles; verify row heights stay equal and that no lookup is sent with the setting off
- [x] 4.4 Settings → Appearance "Covers" group (toggle gated by key, write-only key field, what-is-sent text,
      attribution); i18n keys in all six dictionaries; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 5. Docs and release

- [x] 5.1 Update `CLAUDE.md` (covers design point, endpoints, the opt-in exception to "titles come only from
      file names"); verify the text matches the implementation
- [x] 5.2 Add a `.changeset/` file (`minor`); verify the CI `changes` job accepts it

## 6. List rows and WebTorrent parity

- [x] 6.1 Seek time `min((duration || 600) * 0.03, 60)`; the torrent's frame comes from the largest file in
      WebTorrent's video list, in the UI (`CAPTURE_EXT`, `mainVideo`) and the server (`largest_video`); verify
      `pnpm test` and `cargo test -p torrentx-server` pass
- [x] 6.2 `TorrentRow`: cover background dimmed with the row's state token; `useRowCover` gets a cover for
      on-screen rows; verify `pnpm lint`, `pnpm typecheck` pass
- [ ] 6.3 Verify in `pnpm dev:web` that row text keeps its contrast in dark and light, plain, hovered and
      selected, and that a seeding MP4 torrent gets its row cover without opening it
