## Context

- Source: board D (component states) and board H's surface × state table. Chips and tabs exist as real
  component variants on the canvas (`H6eV4` Chip, `q4CKq` Tab).
- Earlier changes define behaviors; this one fixes the visual/state contract each shared component honors.

## Goals / Non-Goals

**Goals:** every state of every shared component specified once; each data surface ships all four system
states; state color has one source.

**Non-Goals:** new interaction behavior (see `interaction-contract`), motion specs, new surfaces.

## Decisions

1. **State is a prop, not a style fork.** `Chip` takes `{kind: "filter"|"sort", status: "default"|"active"|
   "dragging"|"invalid", negated, overflowCount}`; hover is CSS. One story per state is the acceptance
   artifact.
2. **Funnel count excludes sort** (screen 01: `lens · 3 filters` with a sort chip present). Board D's
   "sort included" wording conflicts; the screen wins because both the badge and top bar caption use the same
   number. Flag for the designer; one constant if reversed.
3. **Overflow wraps.** In the filter bar chips wrap to a second line; `+N more` exists only where space is
   fixed (sidebar badge tooltip, palette strip) and always opens the full list.
4. **State color is derived once.** `stateStyle(status) → {dot, badge}` used by row, detail hero, palette
   context lines and terminal tables; no component picks state colors itself.
5. **Hover actions replace Tags + Tracker cells**, never data columns, so numeric columns never shift.
6. **System states share components.** `<Skeleton rows/>` keeps chips visible; `<EmptyState kind="nothing" |
   "lens" | "engine" | "parse">` renders the copy per the matrix; the zero-after-filter kind receives the
   tab query, the lens and the responsible predicate and renders them as two labelled chip rows.
7. **Terminal output rows are a closed union** (human, json, error, ref, confirm, blocked, pager, running);
   a new row kind requires a spec change.

## Risks / Trade-offs

- **Eight chip states bloat the component.** → Pure props + CSS; invalid/negated are derived from the AST,
  not stored.
- **Matrix cells drift.** → A single table in code (`systemStates.ts`) is the source for tests of each
  surface's four states.
