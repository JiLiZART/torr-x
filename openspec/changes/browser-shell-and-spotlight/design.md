## Context

- Today `App.tsx` renders `Header` (dots, title, search, Add/Terminal/Settings buttons) → `TabBar` → `TorrentList`
  → `StatusBar`, with `AddTorrent`, `Settings` and `RemoveDialog` as `Modal`s. There is no router: the visible
  view is a handful of `useState` flags.
- `query-language-and-smart-tabs` already moved the tab list into a left sidebar and added the filter bar. This
  change builds the rest of the window around them and adds the one global input.
- Themes are three named palettes in `packages/ui/src/theme.css` selected by `preferences.theme` /
  `useSystemTheme` (`lib/theme.ts`). The design (`pen/untitled.pen`) defines one token set, `ui-*`, with a dark
  and a light value per token, plus `ui-sans` = Inter and `ui-mono` = JetBrains Mono.
- Window controls already work through `lib/window.ts` and render only under Tauri; the frameless window and
  rounded corners are in place.
- Source frames: 01–04, 08, 13, 14, 17 and boards B, C, F, G (flow 1), H.

## Goals / Non-Goals

**Goals:** the browser shell; one Spotlight surface for jump, filter, act, create-tab and add; an add flow that
is the same panel; an empty-library state; a navigation history other pages can plug into; one token set that
renders in dark and light; a keyboard map with a shortcut sheet.

**Non-Goals:** the torrent detail page, the terminal drawer, the settings page, first-run setup and the login
redesign (separate changes — this one only provides the routes and tokens they use); tracker search (the
"Search trackers" row in frame 02 is not built — TorrentX has no search provider); user-rebindable shortcuts;
multiple windows; batch add of several `.torrent` files in one panel (each dropped file is added through its
own pass — see Open Questions).

## Decisions

1. **Hash routes, no router dependency.** `lib/route.ts` parses `location.hash` into
   `{view: "tab", tabId} | {view: "torrent", id, section} | {view: "settings", section}` and writes it with
   `history.pushState`. Back/forward in the top bar call `history.back()/forward()`; `⌘[`/`⌘]` do the same.
   The same build is served under `/` in a browser and in the Tauri webview, and hash routes need no server
   rewrite. Later changes register the `torrent` and `settings` views; until then those hashes fall back to the
   active tab. *Alt:* `react-router` — rejected, three views do not justify a dependency.
2. **Spotlight is one component with a mode derived from the input, never chosen by the user.**
   `classify(input)` returns `add` (starts with `magnet:`, is an `http(s)` URL ending in `.torrent`, or a file
   was supplied), `command` (starts with `>`), `query` (`@torrentx/query` parses it *and* it contains at least
   one `field:` predicate), else `jump`. Sections rendered per mode:
   - `jump`: Jump to → Actions (incl. "Filter this tab by name contains …" on ⇥) → pinned "All torrents".
   - `query`: parse strip (chips + `n of total`) → Create tab → Filter results (top 3 + "Show all n", ⇧⏎) →
     Jump to → Actions on the matches.
   - `command`: Actions → Filter → Jump to → Create tab.
   A parse error in something that looks like a query (`contains ":"`) is shown under the input with the column
   caret from `ParseError`; the sections fall back to `jump`.
3. **Nothing behind the panel changes while typing.** Spotlight keeps its own result set computed from the
   torrent list already in memory; the active tab's lens is written only by an explicit pick (⇥ "filter
   instead", a Filter row, ⇧⏎ → switch to All and apply). This is what makes "⌘T never auto-filters" a
   structural property instead of a convention.
4. **One command registry.** `lib/commands.ts` exports `Command {id, title, scope: "selection"|"tab"|"global",
   keys, run, enabled}`. Spotlight's Actions section, the shortcut sheet (⌘K), the global key handler
   (`lib/keymap.ts`) and context menus all read it. A GUI action that is not in the registry cannot get a
   keybinding, which is the enforcement for "every command is in the palette".
5. **The add flow is a state of the Spotlight panel.** `Spotlight` holds `phase: idle | resolving | expanded |
   committing`. In `add` mode it calls the existing `POST /torrents/preview`; the panel keeps its top edge and
   animates height only (CSS `grid-template-rows` transition, 240 ms). `AddTorrent.tsx`'s option form and file
   tree are moved into `spotlight/AddFlow.tsx`; the file list reuses `FilterBar` in its mini variant with the
   file-scoped query fields. Dropping a file anywhere on the window opens the panel in `add` mode. The `Modal`
   add dialog is deleted. Per-torrent limits and tags shown in frame 04 are sent only where the API supports
   them (`tags` via `PUT /torrents/{id}/tags` after add; limits are disabled with the capability hint when the
   engine has no per-torrent limits).
6. **Duplicate and timeout are states, not errors.** A preview whose id is already in the list switches the
   panel to "already in <tab>" with a Jump action. A magnet that has not resolved after 30 s keeps the panel
   open and offers "add anyway" with the `dn=` name.
7. **Tokens: one ramp, two modes, one accent.** `theme.css` defines `--tx-bg, --tx-chrome, --tx-chrome-2,
   --tx-surface, --tx-surface-2, --tx-surface-3, --tx-border, --tx-border-strong, --tx-text, --tx-text-2,
   --tx-text-3, --tx-accent, --tx-accent-soft, --tx-accent-line, --tx-amber(-soft), --tx-cyan(-soft),
   --tx-red(-soft), --tx-violet, --tx-scrim` under `:root[data-mode="dark"]` and `[data-mode="light"]`, with the
   values from the canvas `ui-*` variables. The Tailwind preset maps them to the existing `tx-*` utility
   names so components keep using tokens. Accent choices (`green` default, `cyan`, `amber`, `violet`) override
   the three accent variables only. Radii `8/12/16/22`. Fonts: Inter for UI, JetBrains Mono for queries, ids,
   paths and numbers, both bundled (`@fontsource-variable/*`) — no font CDN, the server may be offline.
   *Alt:* keep the three named themes and add a fourth. Rejected: every new surface would need three palettes
   and none of them has a light/dark pair.
8. **Preference migration.** `preferences.theme` + `useSystemTheme` → `preferences.appearance {mode, accent}`:
   `useSystemTheme: true` → `system`; `light` → `light`; `hacker` and `dark-blue` → `dark`; accent `green` for
   `hacker`, `cyan` for `dark-blue`. Done in `config.rs` on load like the existing v1 migration; the old keys
   are accepted on read and never written.
9. **Status bar and transfer totals.** Rates move to the sidebar foot (frame 01). The status bar keeps match
   counts (`n of total torrents match this tab + lens`), engine name/state, free space and — until the terminal
   change lands — the existing terminal toggle in the position of the future drawer handle. Session ratio, CPU
   and memory move into a popover on the sidebar totals so nothing the current status bar reports is lost.
10. **Sidebar collapse** (⌘B) hides the sidebar to a 0-width rail; window controls and the Spotlight trigger
    move into the top bar while collapsed so the window stays draggable and closable.

## Risks / Trade-offs

- **Shortcut collisions in a browser tab** (⌘T, ⌘W, ⌘1…9, ⌘[ are browser-owned). → Inside the desktop window
  all bindings apply. In a browser, bindings the browser reserves are replaced by fallbacks listed in the
  registry (`/` or ⌘K-then-T for Spotlight, `Alt+1…9` for tabs); the shortcut sheet shows the binding that
  actually works in the current environment.
- **Losing the terminal look** the project documents as a convention. → The accent stays green by default and
  mono is kept for all data; `CLAUDE.md` and `openspec/config.yaml` are updated in the same change so the
  convention text matches the product.
- **Add flow regression** when folding a 500-line dialog into a new panel. → Move, don't rewrite: the request
  building and file-tree logic are relocated unchanged and covered by the existing API tests; only the frame
  around them is new.
- **Spotlight ranking over thousands of rows per keystroke.** → Rank on a pre-lowercased name index, cap each
  section at 8 rows, and debounce at one frame.

## Migration Plan

1. Land tokens + appearance preference (old themes map onto the new modes; nothing else moves).
2. Land the shell and routes behind the existing views; delete `Header.tsx`.
3. Land Spotlight in jump/query/command modes, then the add flow; delete the Add modal.
4. Rollback is a revert: the config migration is read-compatible with the old keys.

## Open Questions

- Several `.torrent` files dropped at once: the design shows a batch summary with one collapsible group per
  torrent. Assumed out of scope here — files are queued and shown one after another in the same panel.
- "Search trackers for …" needs a search provider TorrentX does not have; assumed dropped until one is specced.
