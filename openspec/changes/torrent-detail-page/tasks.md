## 1. Model and engines

- [ ] 1.1 `crates/torrentx-core`: `Tracker {tier, kind, leechers, downloaded, error}`, `Peer.encryption`,
      `TorrentDetails.web_seeds: Option<Vec<WebSeed>>`, normalized tracker status; new capability keys
      `webSeeds`, `addWebSeed`, `reannounce`, `openFile`; verify `cargo test -p torrentx-core`
- [ ] 1.2 Update `packages/api-client` types and the drift fixture pair
      (`crates/torrentx-core/tests/fixtures/torrent.json`, `fixture.check.ts`) if list fields change; verify
      `pnpm typecheck`
- [ ] 1.3 `torrentx-transmission`: map tiers, announce results, leechers, web seeds, `torrent-reannounce`, peer
      encryption; verify unit tests on recorded RPC payloads and the ignored integration test against a daemon
- [ ] 1.4 `torrentx-rqbit`: fill what librqbit exposes, `None` otherwise; `reannounce` / `add_web_seed` return
      `Unsupported` where not available; verify `cargo test -p torrentx-rqbit`
- [ ] 1.5 `engine.rs` dispatch for `reannounce` and `add_web_seed`; verify `cargo test --workspace`

## 2. API

- [ ] 2.1 `POST /torrents/{id}/files/{index}/open` (loopback only, 409 when incomplete, 404 unknown index) and
      `fileIndex` on `/reveal`; verify tower `oneshot` tests for 204 / 403 / 404 / 409
- [ ] 2.2 `POST /torrents/{id}/reannounce` and `POST /torrents/{id}/web-seeds`, 501 when unsupported; verify
      `oneshot` tests including the unsupported path
- [ ] 2.3 Client methods in `packages/api-client`; verify `pnpm typecheck`

## 3. Query scopes and media parsing

- [ ] 3.1 `@torrentx/query`: `evaluateRow(ast, row, scope)` for `file | peer | tracker | webseed`, scope-aware
      parse errors ("not a file field") and completion; verify `node --test` cases per scope
- [ ] 3.2 `packages/ui/src/lib/media.ts`: season/episode, title segment, resolution, HDR and audio tags from
      file paths; `isSeries(files)`; verify `node --test` against a fixture of real-world names including
      `x264` / `1x04` edge cases

## 4. Detail page

- [ ] 4.1 `detail/DetailPage` on the `torrent` route with breadcrumb and back; list kept mounted so scroll and
      lens survive; verify opening and returning from a scrolled, filtered tab
- [ ] 4.2 `Hero`: facts, actions, piece-bucketed progress bar with plain-bar fallback, stat strip, speed graph;
      verify against frames 09 and 15 in both modes
- [ ] 4.3 `SectionTabs` with counts and per-section addresses; per-section polling and contained errors; verify
      by failing `/peers` in devtools while Files keeps updating
- [ ] 4.4 Overview and Pieces sections (facts, piece map, respecting `showPieceMap` / `showSpeedGraph`); verify
      both preferences toggle the right parts

## 5. Sections

- [ ] 5.1 Files list with mini `FilterBar`, visible default lens, priority/skip, shown-of-total, zero-rows
      state; verify with `ext:mkv size:>1GB`
- [ ] 5.2 `MediaView`: season picker, episode strip with hidden markers, episode rows, media/list switch
      remembered per torrent; verify against frame 10 with a season pack
- [ ] 5.3 File row actions: open/play (complete files, loopback only), reveal, copy path, disabled hints;
      verify in the desktop app and from a second machine's browser
- [ ] 5.4 Peers with flags legend, country name from the ISO code, encryption; verify against frame 11 and
      `country:!CN sort:down desc`
- [ ] 5.5 Trackers (tier, status, counts, last/next, failure row, re-announce, add tracker) and Web seeds
      (table, add, unsupported state); verify under rqbit and Transmission

## 6. Cleanup

- [ ] 6.1 Remove `TorrentDetails.tsx` and selection-opens-details; Enter / double-click open the page; update
      the command registry and shortcut sheet (back, forward, jump to section, focus section filter); verify the
      shortcuts on board F "Navigation · detail"
- [ ] 6.2 i18n keys in all six dictionaries, `.changeset/` entry, `CLAUDE.md` notes; verify `pnpm lint`,
      `pnpm typecheck`, `pnpm test`, `cargo test --workspace`
