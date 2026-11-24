## Context

- Boards: THE DAY stop 06, STRUCTURE move 1 ("tracker seed time is a contract the client never models"),
  HOUSE RULES 03 (destructive actions quote the price), REQUIREMENTS R5 (P1), UC7/UC9.
- `policy.rs` already ticks every 5 s with a pure `plan()`: global `min_ratio` / `min_seeding_time` stop
  seeding (`via: server` on rqbit). `state.json` is at v3 after the tags migration.
- `attention-first-list` (pending) classifies `seeding-duty` from the global policy; this change makes the
  target per-torrent and adds the cleanup path.
- Transmission reports `secondsSeeding`; rqbit does not expose accumulated seeding time on the list path.

## Goals / Non-Goals

**Goals:** the user can state a tracker's contract once per torrent and see what is still owed; the client
enforces it; clearing fulfilled torrents is one action with the byte cost shown up front.

**Non-Goals:** per-indexer/tracker rules applied automatically (no tracker→target mapping database); RSS or
automation; changing queue limits; a trash/undo system for deleted data (deletion stays irreversible, hence
the explicit confirmation).

## Decisions

1. **Effective target = override ?? global.** `SeedTarget {min_ratio: Option<f64>, min_seed_time_secs:
   Option<u64>}`; a per-torrent record replaces the global target entirely (not field-merged) so "no limit"
   is expressible (`{}` = seed forever). `PUT` validates non-negative finite numbers. The API returns the
   effective target plus `override: bool` so the UI can show "inherits global" honestly.
2. **Seeding seconds are server-accumulated when the engine is silent.** `store.rs` keeps
   `seeded_secs: HashMap<id, u64>`; each policy tick adds the elapsed interval for torrents observed seeding.
   Engine-reported values (Transmission) win when present. Persisted every tick like other store state;
   reset never happens implicitly. The UI shows time-based duty with a "(tracked by TorrentX)" note when the
   counter is the source — house rule: never invent.
3. **`duty` is derived, not stored.** `none` (incomplete, or no target and no global limit), `pending`
   (complete, effective target not yet met), `fulfilled` (complete, target met — including already-paused
   torrents that met it). Same derivation feeds `attention: seedingDuty` (pending) and `done` (fulfilled),
   keeping one source of truth in `attention.rs`.
4. **Cleanup is a selection + one confirmation.** `Clear fulfilled` acts on the current view's fulfilled
   torrents (group header button, or all rows of a `duty:fulfilled` tab). The confirmation lists count, total
   bytes on disk (sum of wanted sizes), and the distinct save paths, then offers exactly two actions:
   *Keep files* (remove torrents only) and *Delete files* (remove + erase). Delete requires the typed count
   or the confirm chord — the same dangerous-action pattern as the terminal. The API call is the existing
   per-torrent remove endpoint, iterated with a progress line; partial failures are reported per torrent and
   do not abort the rest.
5. **Editing the target is inline.** In the detail hero's obligation line and the row menu: a small popover
   with ratio and seed-time inputs, "inherit global" reset, and a live sentence preview ("will stop at
   ratio 2.0 or after 5 days, whichever comes first"). Saving is one `PUT`, confirmed inline.

## Risks / Trade-offs

- **Server-accumulated time drifts when the server is down.** Accepted and stated: the counter measures time
  TorrentX observed seeding, not wall-clock since completion; the UI note makes the source visible.
- **Bulk delete is the biggest footgun in the app.** → Two-button split, byte cost and paths quoted, typed
  confirmation for data deletion, per-torrent error reporting; never a default-focused Delete button.
- **Override replaces instead of merges.** A user setting only seed time loses the global ratio stop — the
  editor's preview sentence says exactly what will happen before saving.
