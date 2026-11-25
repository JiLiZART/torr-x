## 1. Pure helpers (`packages/ui/src/lib/palette.ts`)

- [x] 1.1 Add `tokenSpans(text, ast)` that splits the input into plain, field and value spans from the predicates' `column`/`length`, and verify with `node --test` cases for `state:active tag:4k`, a trailing partial word, and `!` and quoted values
- [x] 1.2 Add `suggestTabName(ast)`, which keeps the values of positive `=` predicates other than `sort`, ranges and comparisons and joins them with ` · `, and verify that `state:active tag:4k size:>4GB sort:ratio` gives `active · 4k`
- [x] 1.3 Add `queryWords(ast)` and `fileJumps(hits, words, limit)`, and verify with tests that the value `ratio` finds `ratio-watchlist.txt`, that results are ranked by `score`, and that words under 2 characters are ignored

## 2. Palette query mode (`packages/ui/src/components/Palette.tsx`)

- [x] 2.1 Replace the query-mode sections with CREATE TAB FROM THIS QUERY (recommended), FILTER RESULTS · ALL TORRENTS (3 torrents and "Show all N matches"), JUMP TO (tabs and files, omitted when empty) and ACTIONS ("apply to the N matches"), with no registered commands in query mode, and verify in the browser against `pen/nodes/spotlight-query.html`
- [x] 2.2 Fetch `GET /files` once on entering query mode as well as `@` mode, and verify that JUMP TO shows matching files with their torrent and that `⏎` opens the Files section with the file highlighted
- [x] 2.3 Make the query-mode cursor run across sections and start on the first matching torrent; `⇥` applies the lens in the active tab, `⇧⏎` shows all in the All tab and `⏎` opens the selected row; verify each key in the browser
- [x] 2.4 Add the editable name field to the Create row, prefilled by `suggestTabName` and reset when the query changes; `⌘S` or `⏎` in the field creates the tab and Escape or `↑↓` returns to the main input; verify in the browser
- [x] 2.5 Draw query tokens with a mirror layer behind a transparent input, as in design.md, and verify in dark and light that the caret, selection and a long scrolling input stay aligned
- [x] 2.6 Show the query-mode footer `↑↓ navigate · ⏎ open · ⌘S save as tab · ⇧⏎ show all · ⇥ lens · esc dismiss`, keep the other modes' footer unchanged, and verify by switching modes in the browser

## 3. App wiring (`packages/ui/src/components/App.tsx`)

- [x] 3.1 Change `onCreateTab` to `(query, name)` and pass the name to `api.createTab`; verify that the tab appears with the name, that an empty name gives a tab named by its query, and that the active tab and lens do not change
- [x] 3.2 Add `onPauseMatches` and `onTagMatches`, using `pauseRows(notPaused(rows))` and the tags prompt, bound to palette-local `⌘P` and `⌘L` and disabled with a reason when nothing matches; verify in the browser that the matches end up paused and that the tag dialog opens for them

## 4. Strings, docs, checks

- [x] 4.1 Add the new i18n keys to all 6 languages and drop the keys that are no longer used; verify with `pnpm lint`
- [x] 4.2 Update the palette notes in CLAUDE.md and add `.changeset/spotlight-query-layout.md` (`default: minor`); verify that the file exists and that the CI `changes` format matches the other change files
- [x] 4.3 Run `pnpm lint`, `pnpm typecheck` and `pnpm test` and confirm all pass

## 5. Unfinished queries

- [x] 5.1 Add a `draft` palette mode for input that names a known field but does not parse, and verify with `node --test` that `size:` is a draft and `statu:active` stays jump
- [x] 5.2 In draft mode show the parse error in the "parses as" strip and a SUGGESTIONS section from `complete()`; `⏎`/`⇥` inserts the suggestion; verify in the browser with `size:`, `state:` and `tag:`
- [x] 5.3 Add the palette-only `:` field shortcut (`expandFieldShortcut`, `draftCompletion`): `:` lists fields, `:size` + space becomes `size:`; verify with `node --test` and in the browser
