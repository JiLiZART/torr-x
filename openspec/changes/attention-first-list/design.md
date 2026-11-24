## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`): `active-tab.html` (01, the
  list this change regroups); `active-tab-zero-results.html` (06). Read it for layout, spacing and copy; each
  element carries its canvas name in `data-pencil-name`. Colors there are resolved hex values: map them back
  to theme tokens, never copy the hex.
- Research boards: THE DAY stop 03 ("why is this one stuck at 94%?"), STRUCTURE ("group the list by obligation,
  not by status", "say the diagnosis out loud"), HOUSE RULES 02/05/07, REQUIREMENTS R3 (P0), R10 (P0), N1,
  UC3/UC4/UC8.
- `Torrent` already carries `status`, `error`, `peers`, `seeds`, rates, `progress`, `ratio`, `wanted_size`,
  `save_path`. `stats` reports disk free for the download dir. `policy.rs` has the global seed limits.
- `@torrentx/query` (pending) already derives `state:stalled` client-side; `sort:` is the only ordering
  mechanism. `ui-row-activity-and-window-polish` (pending) fixes row height — the precondition for windowing.
- The current web-ui spec's engine-unavailable behavior is "banner instead of an empty list"; the API returns
  503 `engine_unavailable` and the list data is simply gone.

## Goals / Non-Goals

**Goals:** the three-second glance answers "is anything wrong?" (UC3); a stuck torrent says why in one sentence
(UC4); an engine outage degrades to cached data (UC8); thousands of rows stay smooth (N1).

**Non-Goals:** new engine telemetry (no piece-level or per-tracker probing that the engines don't already
report); alerts/notifications (already covered by `app-preferences`); a scheduler; changing how tabs or lenses
work; server-side filtering (stays client-side).

## Decisions

1. **Derive on the server, once, in a pure function.** `attention.rs`:
   `derive(t: &Torrent, live: &LiveStats, ctx: &Ctx) -> (Attention, Option<Diagnosis>)`. `Ctx` carries the
   active seed policy and disk-free bytes per volume; `live` carries whatever tracker/announce stats the engine
   already exposes on the list path. Pure and unit-tested like `policy::plan()`. *Alt:* client-side derivation
   in `packages/query` — rejected: disk-free and policy context live on the server, and every client (CLI,
   terminal `ls`, API consumers) should get the same answer.
2. **The class is an enum with a rank.** `needs-attention (0) · seeding-duty (1) · active (2) · done (3)`.
   Rules, in order: engine `error` / stalled (downloading, 0 peers or 0 rate past a grace period) / reported
   tracker rejection / disk free < remaining wanted bytes / engine "needs verify" state → `needs-attention`;
   complete and still below the active ratio/seed-time target while seeding is expected → `seeding-duty`;
   downloading, checking, queued, or paused-but-incomplete → `active`; complete with no obligation → `done`.
   Grace period (default 60 s from add/resume) prevents fresh torrents flashing "stalled".
3. **Diagnosis is structured, localization is the UI's job.** `Diagnosis {code: String, params: Map}` with a
   closed registry of codes: `stalled-no-peers`, `no-seeds`, `tracker-rejected {tracker, message}`,
   `disk-low {freeBytes, neededBytes}`, `engine-error {message}`, `needs-verify`, `seeding-duty {remaining}`.
   The UI renders `t("diagnosis.<code>", params)`; the terminal prints the same sentence; `--json` prints the
   structure. Unknown inputs → `diagnosis: null`, never a guess (model invariant: unknown fields are null).
4. **Attention-first is a sort, groups are a view.** The seeded All tab's query becomes
   `sort:attention,added desc`. The grouped view renders runs of equal attention rank under collapsible headers
   with counts; it is only offered when the effective sort starts with `attention` (otherwise the toggle is
   disabled with a hint). No new ordering state anywhere — house rule "sort is never a separate control" holds.
5. **Engine-down = cached, dimmed, timestamped, retrying.** The list hook keeps the last successful snapshot
   per tab in memory (not localStorage — stale data must not survive a reload). On 503: render it at 60%
   opacity, one banner "Engine unreachable — showing data from HH:MM:SS, retrying…", poll with backoff
   (2 s → 30 s cap), engine-dependent actions disabled with the reason. Recovery clears the banner in place.
6. **Virtualization without a dependency.** A small pure hook (`useWindow`) computes
   `{startIndex, endIndex, offsetY}` from scrollTop, fixed row height and overscan; rendered rows are
   absolutely positioned inside a spacer of total height. Fixed row height comes from the row-polish change;
   group headers participate as items. Keyboard navigation scrolls the focused row into the window; back-from-
   detail scroll restoration keeps working because total height is stable.

## Risks / Trade-offs

- **Diagnosis over-claims.** A quiet torrent is not always broken → grace period, and every code maps to a
  fact the engine reported; tests assert "no data → null".
- **Rank churn reorders the list under the cursor.** Attention changes are real events, but 1 s polling must
  not shuffle rows constantly → rank changes apply with hysteresis (a torrent must hold the new class for two
  consecutive polls before it moves).
- **Cached data mistaken for live.** Dimming + timestamp + banner are mandatory together; actions are disabled,
  so nothing can be done against stale state.
- **Virtualization breaks find-in-page.** Accepted: browser Ctrl+F only sees rendered rows; Spotlight and the
  filter bar are the search surfaces (board H).
