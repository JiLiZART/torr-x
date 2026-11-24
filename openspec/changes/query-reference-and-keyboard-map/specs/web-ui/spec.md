## ADDED Requirements

### Requirement: Query reference card
The UI SHALL provide one query reference card component, identical wherever it appears — the filter builder,
the palette and the terminal — and toggled by `⌘/` from any query input. It SHALL show a table of fields with
type, example and scope; the operators (`field:value`, `field:!value`, `> < >= <=`, `a..b`, `"two words"`,
`*`, `AND` / `OR`, parentheses); the sort syntax (`sort:ratio`, `sort:name asc`, `sort:state,ratio`) labelled
as a predicate and never a column control; example queries; and the rules (unknown field raises an inline
error with a suggestion, a lens is ANDed onto the tab query, every surface renders the same chips, `⌘C` on the
chip row copies the canonical text). Its content SHALL be generated from the field registry.

#### Scenario: Same card everywhere
- **WHEN** the user presses `⌘/` in the filter builder, then in the palette, then in the terminal prompt
- **THEN** the same card content appears each time

#### Scenario: Registry drives the card
- **WHEN** a field is added to the registry
- **THEN** it appears in the card with its type, scope and example without any other edit

### Requirement: Shortcut sheet bindings
`⌘K` SHALL open the shortcut sheet from anywhere, grouped as Spotlight·Palette, Tabs·Scope, Lens·Chips,
Terminal, List·Selection and Navigation·Detail, each binding with its scope. The bindings SHALL include:
- Spotlight·Palette: `⌘T` open Spotlight (global); `⌘P` jump mode; `⌘⇧P` command mode (`>`); `⌘O` add
  `.torrent` and `⌘V` paste magnet (in Spotlight); `⇥` switch section; `⇧⏎` show all matches in All;
  `⌘S` create tab from the query; `⌘⏎` add & start (add flow); `esc` dismiss with nothing applied.
- Tabs·Scope: `⌘1…9` jump to the nth tab; `⌃⇥` / `⌃⇧⇥` next / previous; `⌘⇧T` new ad-hoc tab; `⌘S` save
  the lens as a tab (tab view); `F2` rename; `⌘⌃↑↓` reorder; `⌘D` duplicate with its lens; `⌘W` close an
  ad-hoc tab (pinned tabs ignore it); `⌘B` collapse/expand the sidebar.
- Lens·Chips: `⌘F` focus the fuzzy input; `⌥F` open the builder; `⌘⇧K` clear the lens; `⌘Z` undo the last
  chip change; `←` `→` move between chips; `⌫` remove the focused chip; `⌥`-click negate in place;
  `⌘⇧S` cycle sort direction; `⌥1…9` cycle the sort field; `⌘C` copy the lens as query text.
- Terminal: `⌃`` toggle the drawer; `⌃⇧`` new terminal tab; `⌘⌥↑` maximize/restore; `⌘\` split; `↑↓`
  history; `⇥` accept completion; `⌃R` reverse search; `⌘⏎` confirm a destructive command; `⌃C` stop a
  streaming command; `⌘S` save the typed query as a tab; `esc` return focus to the list.
- List·Selection: `↑↓` move the cursor; `⇧↑↓` extend; `⌘A` select all the lens shows; `⏎` open detail;
  `Space` pause/resume; `⌘⌫` remove (confirmation); `⌥⌘⌫` remove with data (typed confirmation); `⌘L` add
  a tag; `⌘R` force re-announce.
- Navigation·Detail: `⌘[` back (restores scroll and lens); `⌘]` forward; `⌃1…6` jump to a section; `⌘F`
  focus that section's mini filter bar; `⌘K` shortcut sheet; `⌘/` query reference; `⌘,` settings.
The sheet SHALL render macOS modifiers as shown and Ctrl / Alt on other platforms, SHALL show only bindings
that work in the current environment with the fallback where a browser reserves one, and no two bindings
SHALL collide within overlapping scopes.

#### Scenario: Scope is enforced
- **WHEN** focus is in the list and the user presses `⌘⇧S`
- **THEN** nothing happens, because that binding is live only with the chip row focused

#### Scenario: Platform rendering
- **WHEN** the sheet opens on Linux
- **THEN** `⌘⇧T` is shown as `Ctrl+Shift+T` and `⌥F` as `Alt+F`

#### Scenario: No collisions
- **WHEN** the binding table is loaded
- **THEN** a test finds no duplicate key combination within overlapping scopes
