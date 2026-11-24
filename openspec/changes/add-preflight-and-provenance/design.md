## Context

- Boards: THE DAY stops 02 and 04, STRUCTURE moves 2 and 4, REQUIREMENTS R7 (P1), UC2/UC5.
- The add flow (`add-flow-and-theming`) already shows free space next to the save path, fed by
  the stats disk-free readout — which only covers the configured download dir, not an arbitrary chosen path.
- `empty-library-and-first-run` (pending) adds `POST /fs/check` for path validation; the same path
  validation rules apply here.
- Tags (`active-tab-screen`) established the pattern: server-owned per-torrent metadata in
  `state.json`, engines leave the field null.

## Goals / Non-Goals

**Goals:** the user sees at add time whether the download fits, with the shortfall named; every torrent says
who added it; "what did the robots do overnight" is one keystroke.

**Non-Goals:** refusing adds automatically (warn, never block); a server watch folder; per-API-key accounts
(auth is single-user); attributing existing torrents retroactively; hardlink/space accounting across volumes
(free bytes are per volume, stated as such).

## Decisions

1. **Free space is a path query, not a settings readout.** `GET /fs/free?path=<dir>` resolves to the nearest
   existing ancestor (the chosen subfolder may not exist yet) and returns `{freeBytes, totalBytes, path}` for
   that volume, using the same mechanism as the stats disk-free readout. Path validation matches
   `/fs/check`: absolute, no traversal tricks; the endpoint sits behind the same auth/guard as everything.
2. **The warning is arithmetic the user can see.** `selectedSize = Σ checked files' sizes` (from the preview;
   for a magnet without metadata yet, no warning — unknown is unknown). Warning when
   `selectedSize > freeBytes`, phrased with both numbers and the path, recomputed on every check/path change.
   "Add & start" stays enabled; the button gains no friction beyond the visible line. Post-add, the
   `disk-low` diagnosis carries the same facts into the list.
3. **Provenance is a label, not an identity.** `addedBy` is a free string ≤ 64 chars, trimmed; the UI always
   sends `you`; the API defaults an unnamed add to `api`. It is display metadata — never used for
   authorization. Stored in `state.json` beside tags; survives engine restarts and re-adds by id.
4. **`by:` is an ordinary text field.** Case-insensitive exact match with `*` wildcards (`by:sonarr*`),
   negation for the robot set (`by:!you`). Null provenance matches `by:unknown`. The palette entry
   "Added by automation" is a saved jump to `by:!you added:<24h` — a query, not a new surface.
5. **Column, not badge soup.** "Added by" joins the adaptive column set at the lowest priority tier (hidden
   first at narrow widths, with the value still available in the detail hero and via `by:`). Values other
   than `you` render with a small robot glyph so the overnight batch is scannable.

## Risks / Trade-offs

- **Free space changes between check and add.** Accepted: it is a warning, not a reservation; the phrasing
  says "now", and the disk-low diagnosis catches the race afterwards.
- **`addedBy` is spoofable.** Accepted: single-user auth; it is a breadcrumb, not a security boundary.
- **Magnet adds have no size until metadata arrives.** No warning is shown rather than a wrong one; the
  preview updates when metadata lands and the warning appears then.
