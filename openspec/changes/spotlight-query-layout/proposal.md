## Why

The `⌘T` palette's query mode does not match the design (`pen/nodes/spotlight-query.html`): it leads with generic
selection/tab/global commands, offers the query only as a lens row, and lists matching torrents under JUMP TO. The
design puts the query to work instead: save it as a tab, see what it matches, and act on exactly those matches.

## What Changes

- The query typed in the palette input is drawn as tokens (field and value styled apart) inside the input itself.
- Query mode sections, in order:
  - **CREATE TAB FROM THIS QUERY** (marked "recommended"): one highlighted "Save as smart tab" row with an editable
    tab name, prefilled from the query's values; `⌘S`.
  - **FILTER RESULTS · ALL TORRENTS**: the first 3 torrents matching the query across the library (`⏎` opens one),
    then "Show all N matches" (`⇧⏎`), which activates the pinned All tab with the query as its lens.
  - **JUMP TO**: tabs whose query relates to the typed one, and files whose names match the query's words.
  - **ACTIONS · apply to the N matches**: "Pause all matches" (`⌘P`) and "Add tag to all matches…" (`⌘L`), acting on
    every torrent the query matches. These keys are local to the open palette.
- `⇥` still applies the query as a lens in the active tab, but there is no row for it; the footer names it.
- Footer in query mode: `↑↓ navigate · ⏎ open · ⌘S save as tab · ⇧⏎ show all · ⇥ lens · esc dismiss`.
- Registered selection/tab/global commands no longer appear in query mode; they stay in plain and `>` modes.
- **BREAKING** (spec): replaces the section order and contents required by "Grouped sections never mix", "Palette
  filter results are lens applications" and "Create tab from the palette".

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `web-ui`: the palette's query mode — input tokens, section order and contents, match-scoped actions, named tab
  creation, file jumps and footer hints.

## Impact

- `packages/ui/src/components/Palette.tsx` (query-mode sections, token input, keys, footer), `packages/ui/src/lib/palette.ts`
  (pure helpers: suggested tab name, token spans, file jumps), `packages/ui/src/components/App.tsx` (match actions,
  create tab with a name).
- Uses existing APIs only: `GET /files`, `POST /torrents/{id}/pause`, `PUT /torrents/{id}/tags`, `POST /tabs` with
  `name`. No server or model change.
- i18n keys in all 6 languages.
