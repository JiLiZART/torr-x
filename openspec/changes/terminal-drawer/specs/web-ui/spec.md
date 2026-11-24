## MODIFIED Requirements

### Requirement: Terminal panel
The UI SHALL provide a terminal drawer, toggled from the top bar and by a shortcut, that slides up over the lower
part of the main area on any view without resizing, re-sorting or scrolling the list beneath it. The drawer
SHALL be resizable and maximizable, SHALL show a handle with its shortcut in the status bar while closed, and
SHALL restore its height, tabs and split layout after a reload. It SHALL have a `client` tab (more can be
opened), a `logs` tab, and a `shell` tab that is always disabled and explains that TorrentX does not run host
commands.

The client tab SHALL execute these commands against the API:
- `ls [query]` — lists the torrents matching the query (all torrents when omitted) as an aligned table of id
  prefix, name, size, ratio and state, ordered by the query's `sort:`, followed by how many of the total are
  shown; `--limit n` caps the rows and `--json` prints the matching torrents as JSON instead;
- `status` — total rates, active/total and ratio;
- `add <magnet|url>` (`--paused` to add paused) — prints the new id;
- `pause`, `resume`, `rm` and `tag` with a target that is either a unique id prefix or a query; `rm --force`
  also deletes the data; `tag` takes `+name` and `-name`;
- `open <target>` — opens that torrent;
- `help`, `help fields` (the query fields with their value types) and `help <command>`;
- `clear`, and `exit` (closes the drawer).
`list` and `remove` SHALL keep working as aliases of `ls` and `rm`. Unknown commands SHALL print
`Command not found: <cmd>`; API errors SHALL be printed. Queries SHALL be parsed by the same language as the
filter bar, so that a query copied from a chip row, Spotlight or the terminal works in any of the others.
Torrent ids and names in the output SHALL be clickable and open that torrent while leaving the drawer open.
Escape SHALL return focus to the list and leave the drawer open.

#### Scenario: Add from terminal
- **WHEN** the user runs `add magnet:?xt=urn:btih:...`
- **THEN** the terminal prints the new id and the torrent appears in the list

#### Scenario: List with a query
- **WHEN** the user runs `ls state:active tag:4k sort:ratio desc --limit 3`
- **THEN** at most three matching torrents are printed, highest ratio first, followed by `3 of 312`

#### Scenario: Same query as the filter bar
- **WHEN** the user copies the active tab's lens as text and runs `ls` with it
- **THEN** the terminal lists the same torrents the lens shows across all torrents

#### Scenario: JSON output
- **WHEN** the user runs `ls state:stalled --json`
- **THEN** the output is a JSON array of the matching torrents with their ids, names and states

#### Scenario: List is not disturbed
- **WHEN** the user opens the drawer over a scrolled list
- **THEN** the list keeps its scroll position and order; its lower part is covered

#### Scenario: Open from output
- **WHEN** the user clicks a torrent id in the output of `ls`
- **THEN** that torrent is opened and the drawer stays open

#### Scenario: Shell is off
- **WHEN** the user selects the `shell` tab
- **THEN** it cannot be activated and states that remote shell is disabled

#### Scenario: Drawer state survives reload
- **WHEN** the user resizes the drawer, splits it and reloads
- **THEN** the drawer has the same height and split

## ADDED Requirements

### Requirement: Terminal errors and completion
A query that does not parse SHALL print the parser's message with the column, a caret line under the failing
text of the command as typed, the suggested correction when there is one, and a pointer to `help fields`; no
request SHALL be sent. While typing, the prompt SHALL show the most likely completion inline, accepted with Tab,
and SHALL list the applicable fields, operators or values with the same candidates the filter builder and
Spotlight offer. The prompt SHALL keep a command history across reloads, navigable with the arrow keys and
searchable.

#### Scenario: Unknown field
- **WHEN** the user runs `ls statu:active`
- **THEN** the terminal prints that `statu` is an unknown field at its column, marks it with carets and suggests
  `state`

#### Scenario: Inline completion
- **WHEN** the user has typed `ls state:`
- **THEN** a state value is shown as inline completion and Tab accepts it

#### Scenario: History
- **WHEN** the user reloads the page and presses the up arrow in the prompt
- **THEN** the last command run before the reload is recalled

### Requirement: Dangerous terminal commands need confirmation
A command that deletes downloaded data, or that would pause, resume, remove or tag more than one torrent through
a query target, SHALL NOT execute on Enter. The terminal SHALL first print what it is about to do — the action,
the number of torrents and their names — and SHALL execute only after an explicit confirm chord or, when data
would be deleted, after the user types the torrent's name (or the number of torrents when there are several).
Anything else SHALL cancel the command and say so.

#### Scenario: Force remove
- **WHEN** the user runs `rm 4b17ef --force` and presses Enter
- **THEN** nothing is removed and the terminal states that data for one torrent will be deleted and how to
  confirm

#### Scenario: Confirmed
- **WHEN** the user then confirms with the chord
- **THEN** the torrent and its data are removed and the terminal reports it

#### Scenario: Cancelled
- **WHEN** the user instead presses Escape
- **THEN** nothing is removed and the terminal prints that the command was cancelled

#### Scenario: Bulk target
- **WHEN** the user runs `pause state:downloading` and it matches eight torrents
- **THEN** the terminal lists the count and names and waits for confirmation before pausing any

#### Scenario: Ambiguous id prefix
- **WHEN** an id prefix matches two torrents
- **THEN** the command does nothing and prints both ids

### Requirement: Save a terminal query as a tab
The terminal SHALL offer "Save as tab" for the query in the prompt, using the same inline confirmation as the
filter bar. Saving from the terminal SHALL add the tab to the sidebar without activating it and SHALL keep focus
in the prompt.

#### Scenario: Save without leaving
- **WHEN** the user types `ls state:stalled`, invokes save as tab and confirms the name
- **THEN** a tab with the query `state:stalled` appears in the sidebar, the active tab is unchanged and the
  caret is still in the prompt

### Requirement: Logs pane
The drawer's `logs` tab SHALL show recent server log entries, newest last, each with time, level and message, and
SHALL keep updating while visible. It SHALL have a filter bar accepting `level:` and free text, with the applied
filter shown as chips. The logs pane SHALL be openable beside the client tab as a split. When the server has
produced no entries, the pane SHALL say so rather than appear broken.

#### Scenario: Filter by level
- **WHEN** the user enters `level:warn` in the logs filter
- **THEN** only warnings and errors are listed and a `level:warn` chip is shown

#### Scenario: Tracker failure appears
- **WHEN** a tracker refuses an announce
- **THEN** a warning naming the torrent appears in the logs pane within a few seconds

#### Scenario: Split view
- **WHEN** the user splits the drawer
- **THEN** the client prompt and the logs are visible side by side

### Requirement: Long-running terminal output
`logs --follow` in the client tab SHALL keep printing new entries until interrupted. It SHALL keep running while
the drawer is closed, and the status bar handle SHALL then show that a command is running and how many. A result
longer than 1,000 lines SHALL open in a pager instead of being appended to the scrollback, and the scrollback
SHALL NOT grow without bound.

#### Scenario: Interrupt
- **WHEN** the user presses the interrupt chord while `logs --follow` is printing
- **THEN** printing stops and the prompt is ready

#### Scenario: Closed while running
- **WHEN** the user closes the drawer while `logs --follow` is running
- **THEN** the status bar handle shows one running command, and reopening the drawer shows the lines printed
  meanwhile

#### Scenario: Long result
- **WHEN** `ls` returns 2,500 rows
- **THEN** they are shown in a pager and the scrollback gains a single summary line
