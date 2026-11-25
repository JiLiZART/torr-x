## Context

See proposal.md for motivation and `specs/web-ui/spec.md` for the behavior. Current state:

- `Palette.tsx` builds query-mode sections in one `useMemo` (ACTIONS, FILTER, JUMP TO, CREATE TAB). `↑↓` moves inside
  a section and `⇥` switches section.
- `lib/palette.ts` holds the pure, tested logic (mode detection, ranking, file results).
- The parser returns `Pred` nodes with `column`/`length`, so token positions come straight from the AST.
- `useKeymap` is already disabled while the palette is open (`dialogOpen` includes `palette`). Keys the palette
  handles in its own `onKeyDown` never reach global commands.
- `App` already has `pauseRows(rows)`, the tags prompt `setPrompt({ kind: "tags", torrents })`, and
  `api.createTab({ query, name })`.
- `GET /files` is fetched once per palette, but only in `@` mode today.

## Goals / Non-Goals

**Goals:**
- Query mode matches `pen/nodes/spotlight-query.html` in structure, order and keys.
- New logic lives in pure functions in `lib/palette.ts` with `node --test` coverage.

**Non-Goals:**
- No change to plain mode, `>` mode or `@` file mode.
- No server, API or model change.
- No new global commands: the two match actions exist only inside the palette and are not in `COMMANDS`. That also
  keeps them out of the shortcut sheet's global list.

## Decisions

### Tokens via a mirror layer behind a transparent input
Keep the native `<input>` (caret, IME, selection and undo stay native) and give it transparent text. Behind it sits
a mirror `<div>` with the same font, size and letter spacing that renders the text split into spans. Each
`Pred`'s `[column, column+length)` becomes a token span. As in the design, a token is color only: the field part is
muted and the value is accent, with no box or padding, so glyph positions match the input exactly. The mirror scrolls
with `input.scrollLeft`, and the input's selection is a translucent accent so the tokens show through it.
Alternative: a `contentEditable` with real chip elements. Rejected because caret, paste and IME handling would have
to be rebuilt by hand.

### Pure helpers in `lib/palette.ts`
- `tokenSpans(text, ast)` → `{ text, kind: "plain" | "field" | "value" }[]`, built from the top-level predicates
  found by walking the AST.
- `suggestTabName(ast)` → values of positive `=` predicates other than `sort`, ranges and comparisons, joined with
  ` · ` (for example `active · 4k`).
- `queryWords(ast)` → the values of all predicates, plus the `sort:` field names, lowercased and unique, with `*`
  stripped and words under 2 characters dropped. These words drive JUMP TO for tabs and files.
- `fileJumps(hits, words, limit)` → files whose name contains a word, ranked with the existing `score`.

### One cursor across sections
In query mode the cursor runs over the flat row list (`flat`), so `↑↓` crosses sections. `⇥` is now the lens key,
so it no longer switches sections there. Other modes keep the section cursor. The initial cursor is the first
FILTER RESULTS torrent row, which makes `⏎` open a torrent, as the footer says. Create tab needs `⌘S` or an
explicit selection, so a stray `⏎` never writes to the sidebar.

### Name field
The Create row embeds a small `<input>` for the name, held in palette state and reset whenever the query's
canonical text changes. Clicking it focuses it. Inside it, `⏎` or `⌘S` creates the tab, and Escape or `↑↓` returns
focus to the main input. The `onCreateTab(query)` prop becomes `onCreateTab(query, name)`, and `createFromPalette`
passes the name to `api.createTab`.

### Match actions
The palette gets two new props, `onPauseMatches(rows)` and `onTagMatches(rows)`. App implements them with
`pauseRows(notPaused(rows))` and `setPrompt({ kind: "tags", torrents: rows })`. The palette calls `onClose()` first.
The prompt opens after the palette closes, so the two never stack. The match set is `all.filter(evaluate(ast))`,
the same set FILTER RESULTS counts.

### Files in query mode
The existing one-time `api.files()` effect also runs on entering query mode. JUMP TO shows files only once the
files have loaded; until then it shows tabs only. A failed fetch goes to `onError` as it does today.

## Risks / Trade-offs

- [The mirror layer drifts from the input because of font metrics] → both elements share one class string for
  font and size. Verify in dark and light, and in a long input that scrolls.
- [Dropping global commands from query mode hides "Pause selected torrent" there] → it stays in plain and `>` modes
  and on its own key. The spec now says so.
- [`GET /files` cost on a large library when query mode is entered] → it is already a known gap. The fetch happens
  once per palette, and the list renders at most 3 files.

## Migration Plan

UI only, with no data migration. Roll back by reverting the commit.
