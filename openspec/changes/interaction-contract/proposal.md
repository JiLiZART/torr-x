## Why

Boards A (IA), C (surface anatomy), G (interaction spec: five flows) and H (cross-surface contract +
anti-patterns) (`pen/untitled.pen` `K6pFmE`, `X91CR`, `teJ7L`, `yFUm5`) are the design's rules rather than its
screens: how big things are, how long they take, what happens at the edges, and what the product must never
do. The screen changes honor most of the golden rules, but the timings, edge cases and the explicit
anti-pattern list live only on the boards — which is where they get lost. This change turns them into
requirements with scenarios, so each rule can be tested.

## What Changes

- **Information architecture as testable rules** (A): scope = tab query (persistent, sidebar), lens = ephemeral
  per-tab query ANDed on, query = one shared language; the **golden rule** (a lens always scopes to the active
  tab; global filtering only through ⌘T or the pinned All tab) and the **never** list.
- **Surface anatomy** (C): shell zones and sizes (sidebar 248 px, drawer overlays the main area only),
  detail page anatomy, palette anatomy (input row with add-file button, parse strip with `n of 312`, sections,
  pinned All, footer hints), terminal anatomy (tab strip client / logs / shell-disabled, split, maximize).
- **Interaction flows** (G), each with exact timings and edge cases:
  1. *Spotlight → Add Torrent transform*: 720 px panel, 14 px backdrop blur, caret in the input; height
     animates down to 860 px in 240 ms ease-out-expo with the top edge pinned; metadata fade-in order and
     18 ms row stagger; `⌘⏎` add & start, `⇧⏎` add paused; collapse into a toast and a 1.2 s accent row
     highlight. Edges: metadata timeout (>30 s), duplicate hash ("already in Seeding" + Jump), multiple files
     dropped (batch summary, one collapsible group per torrent).
  2. *Save as tab*: inline confirm with name pre-filled ("4K · active"), appended to the active group or
     AD-HOC with a one-time accent flash, producing lens cleared, undo within 5 s; Spotlight-created tab
     activates, terminal-created does not; edges: duplicate query, empty name, unparseable query.
  3. *Lens clearing on tab switch*: snapshot, 120 ms chip-row fade, read-only tab predicates, "restore lens"
     pill for 8 s when ≥2 predicates, lenses dropped on app close; edges: mid-keystroke commit, tab deleted
     while its lens is live.
  4. *Terminal open/close*: 180 ms ease-out slide, list covered not resized, remembered height/tabs/split,
     esc/⌃` rules; edges: command streaming while closed, pager at 1,000 lines.
  5. *Empty-filter recovery*: two labelled chip rows, the narrowest responsible predicate called out with the
     largest match, four recovery actions in order of destructiveness, amber callout (not an error), status
     bar "0 of 312 — tab query returns 41"; edges: engine unavailable, zero from the tab query itself.
- **Cross-surface contract and anti-patterns** (H): the seven rules and nine anti-patterns as scenarios —
  filter-as-tab, hidden active filters, sort outside the query, mixed Spotlight sections, auto-filtering on
  ⌘T, lens leaking across tabs, modal torrent details, silent destructive commands, generic empty states.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: adds the contract, flows, timings and edge cases below; **refines** requirements from
  `active-tab-screen`, `command-palette-screen`, `add-flow-and-theming`, `terminal-drawer` and
  `torrent-detail-screen`.

## Impact

- `packages/ui`: motion tokens (`--tx-ease-expo`, durations), palette add-mode animation, toast + row
  highlight, lens snapshot store (`restore lens` pill), `RecoveryEmptyState`, batch add summary; a contract
  test suite (`contract.test.ts`) asserting the anti-patterns (no sort header handlers, chips visible when
  the bar is collapsed, sidebar untouched by lens operations).
- Reconciliations: palette width 720 px (was 640); new tab `⌘⇧T`; drawer default covers from 508 px down
  (= 416 px height in the reference window).
- No API changes. Depends on all UI screen changes; lands last.
