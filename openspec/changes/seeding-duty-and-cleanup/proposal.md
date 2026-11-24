## Why

THE DAY stop 06 ("seeding duty") and UC7: a private tracker wants five days of seeding, and that contract lives
outside every client — in a spreadsheet of habits. The guides disagree (TRaSH says disable client limits and
manage per indexer; others say ratio 2.0), which is exactly why the obligation must be per torrent, visible,
and enforced by the client. UC9: thirty finished torrents are done seeding and the user clears them in one
action with the freed space shown. Today TorrentX has global seed limits in `policy.rs` but no per-torrent
target, no "what do I still owe" answer, and no bulk cleanup.

## What Changes

- **Per-torrent seed targets**: `PUT /torrents/{id}/seed-target` sets a ratio and/or seed-time target for one
  torrent, overriding the global downloads policy; `null` inherits the global target. The policy loop honors
  the effective target (server-side where the engine lacks it, as today).
- **Obligation, stated**: `Torrent` gains `seedTarget` (effective target + whether it is an override),
  `seededSecs` (engine-reported seeding time, `null` when the engine doesn't keep it) and `duty`
  (`pending | fulfilled | none`). The UI says "keep seeding — 2.3 days left" or "ratio 1.1 / 2.0", and
  "free to remove" when the obligation is met. This refines the `seeding-duty` attention class from
  `attention-first-list` to use the effective per-torrent target.
- **Query field `duty:`** so "what do I still owe" is a tab: `duty:pending`, `duty:fulfilled`.
- **Clear fulfilled**: a bulk action on the fulfilled set (from the group header, a `duty:fulfilled` tab, or a
  multi-selection) that removes those torrents in one confirmation. The confirmation quotes the price
  (house rule 03): count, total bytes freed, the paths involved, and two explicit buttons — *Keep files* and
  *Delete files* — never one ambiguous "Remove". Enter alone never confirms a data deletion.
- **Seeding time honesty**: where the engine reports no seeding time (rqbit today), the server accumulates it
  in `state.json` while the torrent is seeding, and a time-based target is enforced from that counter; the UI
  marks the source so nothing is invented.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `http-api`: seed-target endpoint; `Torrent` gains `seedTarget`, `seededSecs`, `duty`.
- `torrent-engine`: "Seeding and queue policy" (from pending `adopt-magic-patterns-ui`) honors per-torrent
  effective targets.
- `torrent-query`: new field `duty:`.
- `web-ui`: obligation display and editing, bulk clear-fulfilled with the cost stated.

## Impact

- `crates/torrentx-core`: `Torrent` gains the three fields; drift fixture + `packages/api-client` updated
  together.
- `crates/torrentx-server`: `store.rs` per-torrent target map + accumulated seeding seconds (v3→v4 migration
  adds empty maps); `policy.rs` `plan()` takes effective targets (pure tests extended); `api.rs`
  `PUT /torrents/{id}/seed-target`; attention derivation uses the effective target.
- `packages/query`: `duty` field; `packages/ui`: obligation line in the detail hero and row, target editor
  (inline popover), `Clear fulfilled` action + cost confirmation dialog reusing the destructive-confirm
  component; i18n keys in six dictionaries.
- Depends on `attention-first-list` (duty class, groups) and `query-language-and-smart-tabs` (query, tabs).
  No engine crate changes: seeding-time accumulation and per-torrent stops are server policy (`via: server`).
