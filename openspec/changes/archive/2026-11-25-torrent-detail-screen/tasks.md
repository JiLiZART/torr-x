## 1. Model and engines

- [x] 1.1 `crates/torrentx-core`: `Tracker` gains `tier, kind, leechers, downloaded, error, last_announce,
      next_announce`; `Peer` gains `flags, encryption`; `TorrentDetails` gains `web_seeds: Vec<WebSeed>`
      (`url, kind, status, speed, downloaded, error`); update drift fixture + `packages/api-client` together;
      verify `cargo test -p torrentx-core` + fixture check
- [x] 1.2 rqbit + Transmission fill the new fields where available, `null` otherwise; DHT/PeX pseudo-rows
      where the engine exposes them; verify engine tests assert shape parity and honest nulls
- [x] 1.3 Capability keys `webSeeds, addWebSeed, reannounce, openFile` per engine; verify capabilities API
      tests
- [x] 1.4 Verify `cargo test --workspace` passes

## 2. Server endpoints

- [x] 2.1 `api.rs`: `POST /torrents/{id}/reannounce`, `POST /torrents/{id}/web-seeds`,
      `POST /torrents/{id}/files/{index}/open`, `POST /torrents/{id}/files/{index}/reveal`; 501 where
      unsupported, 404 on bad index; verify tower `oneshot` tests incl. the 501 paths
- [x] 2.2 Verify guard/auth apply to the new routes (same test matrix as existing mutations)

## 3. Query: section fields

- [x] 3.1 `packages/query`: register file/peer/tracker/web-seed fields and evaluation against those row
      types; verify `node --test` for `ext:mkv priority:!skip`, `country:!CN flags:!snubbed`,
      `status:!disabled sort:tier asc`, `ep:>3 sort:ep asc`

## 4. Detail page shell

- [x] 4.1 `DetailPage` + breadcrumb (`← <tab> ⌘[ / <name>`), routes per section, back restores list scroll +
      lens; verify navigation round-trip manually and Enter/double-click opens while click selects
- [x] 4.2 `Hero`: meta line, actions (Pause/Resume, Verify, Reveal, Remove, overflow), progress % + stat
      strip (progress, transferred, eta, down, up, seeds x of y, peers x of y, ratio); verify values match
      the API and update live without layout shift
- [x] 4.3 `SectionTabs` with live counts; `MiniFilterBar` (input, funnel count, chips, sort chip, + filter,
      shown-of-total); section lens keyed per torrent+section, cleared on leave, never saved; verify chips
      and counts behave identically to the list's filter bar

## 5. Files and media mode

- [x] 5.1 `FilesSection`: format label + view switcher, columns NAME/SIZE/DONE/PRIORITY/ACTIONS, wanted
      checkbox, type icons, priority menu; verify priority/skip changes persist through the API
- [x] 5.2 `lib/fileActions.ts` format→actions table with capability/platform gating; verify video rows show
      play/library/cast, iso/archive show contents/mount, others open/reveal/copy path, unsupported disabled
      with the engine hint
- [x] 5.3 `lib/media.ts` pure parser (season/episode/quality/title) with `node --test`; media mode offered
      only on confident multi-episode parses; verify titles/durations render only when known
- [x] 5.4 `MediaView`: season picker, episode strip with dashed lens-hidden numbers, episode rows (code,
      title?, duration?, quality tags, size, progress, state word), featured Play button, per-row actions;
      verify `ep:>3` dashes 1–3 and the switcher returns to the plain list with the lens intact

## 6. Peers, Trackers, Web seeds

- [x] 6.1 `PeersSection`: columns as drawn, flag letters + legend, ENC, country code+name; verify
      `country:!CN flags:!snubbed sort:down desc` reproduces screen 11's set and count line
- [x] 6.2 `TrackersSection`: header counts, Add tracker, columns as drawn, working/updating/not-working
      states, failure reason + re-announce, DHT/PeX pseudo-rows; verify against both engines (nulls → `—`)
- [x] 6.3 `WebSeedsSection`: header counts, Add web seed (capability-gated), BEP type, status, speed,
      downloaded, failure reason; verify 501 handling disables the add with the hint
- [x] 6.4 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test`, `cargo test --workspace` pass; i18n keys in all
      six dictionaries; manual check of screens 09–12 in dark and light against the canvas frames

## 7. Docs

- [x] 7.1 Update `CLAUDE.md` (detail page, media module, new endpoints); verify text matches implementation
