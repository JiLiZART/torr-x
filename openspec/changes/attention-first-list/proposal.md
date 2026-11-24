## Why

The research boards (`pen/untitled.pen`: THE DAY stop 03, STRUCTURE moves 1 and 5, HOUSE RULES 02/05/07,
REQUIREMENTS R3/R10/N1, use cases UC3/UC4/UC8) converge on one finding: every client shows the numbers, none
states the diagnosis. "248/14" is data; "stalled: 0 seeds across 2 trackers" is an answer. Today the TorrentX
list sorts by whatever `sort:` says (default: added date), a stuck torrent looks exactly like a healthy one,
and an unreachable engine turns the window into a banner over an empty list. The user opens the window for
three seconds to check nothing is wrong (UC3) — the list must answer that before it shows what is running.

## What Changes

- **Derived attention class** on every torrent, computed by the server from data it already has:
  `needs-attention` (stalled, errored, tracker rejected, disk nearly full, needs verify), `seeding-duty`
  (complete but still owes ratio/seed time under the active policy), `active`, `done`. Exposed as
  `Torrent.attention` and as the query field `attention:` with `sort:attention`.
- **Structured diagnosis**: `Torrent.diagnosis` is a machine-readable `{code, params}` (e.g.
  `stalled-no-peers {seeds: 0, trackers: 2}`), never an English string — the UI renders it as one localized
  verdict sentence. Null when there is nothing to say; never invented from data the engine does not report.
- **Attention-first list**: the built-in All tab defaults to `sort:attention`; an optional grouped view renders
  the four obligation groups (needs attention · seeding duty · active · done) with counts and collapse —
  grouping is a rendering of `sort:attention`, not a second ordering mechanism.
- **Verdict where the numbers are**: the row's state cell shows the diagnosis sentence (house rule 02: name the
  state, prove it with numbers in the detail page); the detail hero opens with the same sentence.
- **Engine-down cached view**: on `engine_unavailable` the UI keeps the last good list (dimmed, timestamped),
  one banner, automatic retry with backoff; actions that need the engine are disabled with the reason. Never
  an empty screen (house rule 07).
- **List virtualization**: windowed rendering at fixed row height so the list stays usable at thousands of
  torrents (N1, a Known Gap in CLAUDE.md) with no layout shift at 1 s polling (house rule 05).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `http-api`: `Torrent` gains `attention` and `diagnosis`; server-side derivation rules and honesty guarantee.
- `torrent-query`: new field `attention:` and sort key `sort:attention`.
- `web-ui`: attention-first default ordering, obligation groups, diagnosis sentence, cached engine-down view,
  virtualized list. **Modifies** the pending `query-language-and-smart-tabs` requirement "Torrent list with
  live refresh".

## Impact

- `crates/torrentx-core`: `Torrent` gains `attention: Attention` and `diagnosis: Option<Diagnosis>`; drift
  fixture `tests/fixtures/torrent.json` + `packages/api-client/src/fixture.check.ts` updated together.
- `crates/torrentx-server`: new `attention.rs` (pure `derive()` with unit tests, in the style of `policy.rs`
  `plan()`); list assembly fills the fields; disk-pressure input from the existing stats disk-free readout.
- `packages/query`: `attention` in the field registry, rank order for `sort:attention`.
- `packages/ui`: `TorrentList` grouped view + virtualization hook (pure, `node --test`), diagnosis rendering
  via `t("diagnosis.<code>", params)`, engine-down cache in the list data hook, detail hero verdict line.
- i18n: diagnosis sentence keys in all six dictionaries.
- No engine changes: derivation uses only fields the engines already report; missing inputs yield no claim.
- Depends on `query-language-and-smart-tabs` (query, tabs) and `ui-row-activity-and-window-polish` (fixed row
  height). `seeding-duty-and-cleanup` later refines the `seeding-duty` class with per-torrent targets.
