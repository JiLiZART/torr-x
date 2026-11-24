## 1. Model and server derivation

- [ ] 1.1 `crates/torrentx-core`: add `Attention` enum (`needsAttention | seedingDuty | active | done`) and
      `Diagnosis {code, params}`; `Torrent` gains `attention` and `diagnosis: Option<_>`; update
      `tests/fixtures/torrent.json` and `packages/api-client/src/fixture.check.ts` together; verify
      `cargo test -p torrentx-core` and the api-client fixture check pass
- [ ] 1.2 `crates/torrentx-server/src/attention.rs`: pure `derive()` implementing the class rules and the
      diagnosis code registry from design.md, with the 60 s grace period and "missing input → null" rule;
      verify unit tests cover each code, the grace period, and a torrent with no live stats yielding
      `diagnosis: null`
- [ ] 1.3 Fill the fields in list assembly for both engines; disk-low uses the stats disk-free readout for the
      torrent's save-path volume, seeding-duty uses the active policy targets; verify tower `oneshot` API
      tests: a stalled torrent returns `attention: needsAttention` and code `stalled-no-peers`, a completed
      torrent under its ratio target returns `seedingDuty`
- [ ] 1.4 Verify `cargo test --workspace` passes

## 2. Query language

- [ ] 2.1 `packages/query`: register `attention` (values `needs-attention | seeding-duty | active | done`)
      and `sort:attention` (rank order, ties by the next sort key); verify `node --test` cases for filtering
      by each value and for `sort:attention,added desc`
- [ ] 2.2 Seed the built-in All tab with `sort:attention,added desc` (migration keeps user-edited queries
      untouched); verify a fresh `state.json` gets the new default and an existing customized All tab does not
      change

## 3. UI: ordering, groups, diagnosis

- [ ] 3.1 Grouped view in `TorrentList`: collapsible headers with counts for the four groups, offered only
      when the effective sort starts with `attention`; rank changes apply with two-poll hysteresis; verify
      against a running server that a paused seeding torrent sits under "seeding duty" and collapsing a group
      persists for the session
- [ ] 3.2 Diagnosis sentence: row state cell and detail hero render `t("diagnosis.<code>", params)`; add the
      sentence keys to all six dictionaries; verify `pnpm lint` i18n parity passes and a stalled row reads as
      a sentence, not numbers
- [ ] 3.3 Terminal `ls` prints the diagnosis sentence in the state column and the structure under `--json`;
      verify a `node --test` case on the table formatter
- [ ] 3.4 Verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 4. Engine-down cached view

- [ ] 4.1 List data hook keeps the last good snapshot per tab in memory; on 503 render it dimmed with the
      timestamp banner and backoff retry (2 s → 30 s); engine-dependent actions disabled with the reason;
      verify manually: stop the engine (bad Transmission host), the list stays visible with one banner, and
      recovers in place when the engine returns
- [ ] 4.2 Verify a reload during the outage shows the empty-library/zero-results state as appropriate, never
      stale cached rows

## 5. Virtualization

- [ ] 5.1 Pure `useWindow` module (start/end/offset from scrollTop, row height, overscan, group headers as
      items) with `node --test`; wire into `TorrentList` with a total-height spacer; verify keyboard
      navigation scrolls the focused row into view and back-from-detail restores scroll position
- [ ] 5.2 Verify manually with a seeded library of 5,000 torrents: scrolling stays smooth, 1 s updates cause
      no layout shift, and Spotlight/filter still find off-screen torrents

## 6. Docs

- [ ] 6.1 Update `CLAUDE.md` (attention derivation, virtualization no longer a Known Gap) and the query
      reference card on the canvas is unchanged grammar-wise (new field only); verify text matches the
      implementation
