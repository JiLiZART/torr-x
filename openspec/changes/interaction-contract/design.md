## Context

- HTML reference (HTML + Tailwind export of the canvas frames, in `pen/nodes/`): `scope-lens-query.html`
  (board A). Read it for layout, spacing and copy; each element carries its canvas name in `data-pencil-name`.
  Colors there are resolved hex values: map them back to theme tokens, never copy the hex. Boards C, G, H have
  no export; use `pen/untitled.pen` for those.
- Sources: A (`K6pFmE`), C (`X91CR`), G (`teJ7L`), H (`yFUm5`). The screens are covered by their own
  changes; this one adds cross-cutting behavior and acceptance tests.

## Goals / Non-Goals

**Goals:** timings and edge cases are specified once; the anti-patterns are executable tests; motion respects
the user's reduced-motion setting.

**Non-Goals:** new surfaces, new API, theming, marketing copy.

## Decisions

1. **Motion tokens, one place.** `--tx-dur-panel: 240ms`, `--tx-dur-drawer: 180ms`, `--tx-dur-fade: 120ms`,
   `--tx-dur-highlight: 1200ms`, `--tx-stagger-rows: 18ms`, `--tx-ease-expo: cubic-bezier(0.16, 1, 0.3, 1)`.
   Under `prefers-reduced-motion` all durations collapse to 0 and stagger is disabled; state is still shown
   (the accent highlight becomes a static outline for the same period).
2. **Palette add mode pins the top edge.** The panel animates `height` from input-only to 860 px; the input
   element is never re-mounted, so caret and scroll never move. Content reveals in order: header, files tab,
   rows staggered 18 ms (cap at the first ~30 rows to bound total time).
3. **Lens snapshots are an in-memory map `tabId → lens`.** Written on leave, read on return, never persisted;
   the restore pill shows for 8 s when the snapshot has ≥2 predicates. Deleted tab → fallback to All, drop the
   lens, toast the reason. Mid-keystroke commit: parse the longest valid prefix, drop the trailing fragment.
4. **Save as tab undo window is 5 s**, implemented as delete-tab + restore-lens; the toast carries `⌘Z`.
   Origin decides focus: palette → new tab becomes active; terminal → no focus steal; filter bar → stays.
5. **Recovery empty state computes the culprit.** For a lens with predicates p1…pn the culprit is the single
   predicate whose removal brings the result count above 0 with the largest match reported ("largest match is
   42.1 GB"); ties pick the last-added. The four actions map to existing commands (`⌘⇧K`, `⌘Z`, `⌥F`, `⌘T`).
   If the tab query alone yields 0 (no lens) the first action becomes "Edit this tab's query".
6. **Contract tests.** A suite renders the shell and asserts the anti-patterns: no click handler on column
   headers that sorts without producing a `sort:` chip; the chip row is present whenever the lens is
   non-empty, including with the bar collapsed; lens operations never change the sidebar's tab list;
   palette sections are homogeneous; no destructive command runs on bare Enter; every empty list renders
   a named cause.
7. **Engine-unavailable precedence.** An engine error always wins over zero-results copy: with a cached list
   (`attention-first-list`) it shows the dimmed list + banner; with none it shows the error state with
   Retry, keeping the query intact.

## Risks / Trade-offs

- **Culprit search costs O(n·p).** → p is small (≤ ~10) and n is hundreds; computed lazily only when the
  result is zero.
- **Animation fights virtualization or focus.** → Animations are transform/opacity/height on the panel
  only; list rows never animate except the single new-row highlight.
- **Contract tests become brittle.** → They assert behaviors via the query/state layer, not pixels.
