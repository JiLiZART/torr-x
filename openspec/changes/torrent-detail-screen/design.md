## Context

- Source of truth: screens 09 (`YpnAn`), 10 (`U264ly`), 11 (`SeBYT`), 12 (`xfkVA`); board C "Torrent detail",
  board H "Modal torrent details" anti-pattern.
- `active-tab-screen` provides the shell, navigation slots, `@torrentx/query` and the lens mechanics.
- Current code: `TorrentDetails.tsx` panel (General/Trackers/Peers/Seeds/Files), `Tracker {url, status,
  seeds, peers}`, `Peer {ip, port, client, progress, down, up, country}`; geoip via DB-IP already in the
  server; rqbit and Transmission report different subsets.

## Goals / Non-Goals

**Goals:** the four screens as drawn; every section filterable with the same language; media mode that never
invents metadata; honest nulls and capability-gated actions.

**Non-Goals:** streaming playback internals (the play affordance renders here; the stream endpoint is the
`streaming-playback` change), piece-map rendering details beyond the existing Pieces section, subtitle
fetching, library/cast integrations beyond registering the actions (disabled with a hint until implemented).

## Decisions

1. **Page + addresses.** Views: `tab/<id>` → `torrent/<id>/<section>`. Back (⌘[ / breadcrumb) restores the
   tab's scroll offset and lens from a session snapshot. Section tabs carry live counts; the separate
   "Seeds" tab is gone (it is `flags:`/sort on Peers).
2. **One mini filter bar component, section field sets.** Files: `ext, priority, ep, season, name, size,
   done`; Peers: `country, client, flags, progress, down, up`; Trackers: `status, tier, url`; Web seeds:
   `status, type, url`. Same parser/chips/sort; the section lens lives in memory per torrent+section, never
   saved, cleared on navigation. Count line: `shown of total · lens scoped to this section`.
3. **Media parsing is a pure module** (`lib/media.ts`): season/episode from `S02E04`/`2x04` patterns, quality
   tags from filename tokens (2160p/1080p, DV, HDR10, Atmos, DDP5.1…), release title cleanup. Episode *titles*
   and *durations* render only when known (filename-derived title or engine metadata); otherwise the row
   shows `S02E04` alone — screen 10's titles are illustrative, not a data promise. Media mode is offered only
   when ≥2 video files parse as episodes of one show; the switcher remembers the choice per torrent.
4. **Episode strip mirrors the lens.** Numbers hidden by the section lens render dashed (as drawn for
   `ep:>3`); clicking a number scrolls to / filters that episode. The featured row is the first ready-to-play
   episode; "ready to play" uses the downloaded-head heuristic (shared with `streaming-playback`).
5. **Format-aware actions from one table.** `lib/fileActions.ts` maps extension class → action list
   (video: play/library/cast; iso/archive: show contents/mount; other: open/reveal/copy path), each action
   gated by capability + platform; unsupported render disabled with the engine hint, never hidden.
   `open`/`reveal` call the per-file endpoints (desktop: opener plugin; browser: reveal disabled with hint).
6. **Trackers model the pseudo-rows.** `Tracker.kind: "tracker"|"dht"|"pex"`; DHT/PeX rows have tier `—`,
   no announce schedule, and are not editable. Failure reason is the engine's text, shown verbatim under the
   row with a re-announce action (capability-gated). Web seeds: `kind: "bep19"|"bep17"`, status, speed,
   downloaded, error — null where the engine is silent.
7. **Peers flags are letters, legend below.** D downloading-from, U uploading-to, X (engine-specific),
   I incoming, E encrypted, K unchoked, S snubbed, ? unknown; ENC column shows the cipher (`rc4`) or `—`.
   Country from the existing geoip path; unknown → `—`, never guessed.

## Risks / Trade-offs

- **Episode parsing misfires on odd names.** → Media mode is opt-in via the switcher and only offered on
  confident parses; the plain list is always one click away; pure-module tests cover the patterns.
- **Engines report different subsets.** → Every new field is optional/null; a fixture-driven test asserts
  both engines serialize the same shape; the UI renders `—` for nulls.
- **Section lenses multiply state.** → One keyed store (`torrentId:section`), cleared on leave; no
  persistence, no sidebar interaction — the golden rule holds.
