## 0.2.0 (2026-11-28)

### Breaking Changes

- GET /tabs returns {grammarVersion, tabs}; Torrent.tabId
is replaced by Torrent.tags; PUT /torrents/{id}/tab answers 410, use
PUT /torrents/{id}/tags.
- preferences.theme and preferences.useSystemTheme are
replaced by preferences.appearance.

#### Tabs are saved queries: new sidebar, filter bar and query language

The home screen is rebuilt around one query language (`state:active tag:4k size:>4GB sort:ratio desc`). Tabs live
in a left sidebar and are saved queries with live match counts; a per-tab lens adds removable filter chips, a
filter builder and "Save as tab". Torrents carry tags instead of belonging to one tab, and the list shows state,
tags, ratio and tracker columns.

Breaking API changes: `Tab` is now `{id, name, query, order, pinned, group}` and `GET /tabs` returns
`{grammarVersion, tabs}`; `Torrent.tabId` is replaced by `Torrent.tags` (plus a new `Torrent.tracker`);
`PUT /torrents/{id}/tab` answers 410, use `PUT /torrents/{id}/tags`. Existing `state.json` files migrate on
first start: each old tab keeps its torrents through a `tag:<name>` query.

#### Add torrents from Spotlight, and light / dark themes with an accent

Adding a torrent no longer opens a dialog. Paste a magnet link or `.torrent` URL into Spotlight (⌘T), press
"Add .torrent" or ⌘O, or drop a file on the window: the same panel grows into the add flow with the torrent's
files (filter them with the query language, e.g. `ext:mkv size:>1GB`), trackers, save path, tags and options.
⌘⏎ adds and starts, ⇧⏎ adds paused, Esc goes back.

The three fixed themes are replaced by a mode (System, Light, Dark; System follows the OS live) and an accent
(green, cyan, amber, violet). Every screen now uses one set of theme colors in both modes, and the fonts ship
with TorrentX.

Breaking settings change: `preferences.theme` and `useSystemTheme` are replaced by
`preferences.appearance {mode, accent}`. Existing settings convert on first start (Hacker becomes dark/green,
Dark Blue dark/cyan, Light light; "use system theme" becomes System).

#### Torrent detail page

Torrents open as a page instead of a panel under the list: press Enter or double-click a row (a single click
now only selects), and ⌘[ or the breadcrumb returns to the list with the same scroll position and filter. The
page has a status hero with live stats and actions, and sections Overview, Files, Peers, Trackers, Web seeds
and Pieces, each with its own filter bar in the query language (`ext:mkv priority:!skip`,
`country:!CN flags:!snubbed sort:down desc`, `status:!disabled sort:tier asc`).

Files show download progress, priority (including skip) and actions that fit the file type; season packs can
be shown as episodes with their quality tags. Peers show country, client, flags with a legend and encryption.
Trackers show tiers, status, failure reasons and re-announce; DHT and PeX appear as rows when they supply peers.

Breaking API changes: `Tracker.peers` is renamed `leechers`, and trackers gain `kind`, `tier`, `error` and
`downloaded`; peers gain `encryption`; torrent details gain `webSeeds`. New endpoints
`POST /torrents/{id}/reannounce`, `POST /torrents/{id}/web-seeds` and `POST /torrents/{id}/files/{index}/open`
and `/reveal`.

### Features

- tabs as saved queries with sidebar, lens and query language
- match the active tab screen to the canvas exports
- new terminal-prompt app icon
- Spotlight palette with command registry, add flow and light/dark themes
- torrent detail page with sections, mini filter bars and media view
- GET /files lists every torrent's files in one request
- search files across torrents from Spotlight
- Spotlight query mode matches the design
- suggest completions for unfinished Spotlight queries
- settings page, categories, file tree and list customization
- play and stream episodes in an external player
- covers for torrents and video files
- frames for files the browser's player rejects
- Files first, combined progress block, per-episode graph
- covers for torrents and video files
- sign-in screen with lockout, built-in player for streams
- native-style window buttons on Windows and Linux

#### Spotlight: one panel to jump, filter and act

⌘T (⌘P in a browser) opens a single panel. Plain text jumps to tabs and torrents and never filters on its own;
a query such as `state:paused` shows grouped ACTIONS, FILTER, JUMP TO and CREATE TAB sections; a leading `>`
lists commands only. New tab opens the same panel. Every GUI command is in one registry with its key binding,
the list is fully keyboard-operable (row cursor, multi-select, Space to pause/resume, ⌘⌫ to remove), and ⌘K
shows a shortcut sheet with the bindings that work on your platform and in your browser.

#### Native-style window buttons on Windows and Linux

The desktop window now shows window buttons that match the OS. On Windows, minimize, maximize and close caption
buttons sit flush in the top-right corner, and close turns red on hover. On Linux, three round buttons sit at
the right of the top bar, and the window corners are rounded by 12 px. While the window is maximized, the
maximize button shows a restore icon. macOS keeps its red, yellow and green dots.

#### First public release with downloadable binaries

Every release now ships the headless `torrentx-server` for Linux (x86_64, aarch64) with its systemd unit, and the
desktop app for macOS (universal `.dmg`), Windows (`.msi`, setup `.exe`) and Linux (`.AppImage`, `.deb`), plus
`SHA256SUMS.txt`. A rolling `nightly` pre-release is rebuilt from every push to `main`.

#### Sign-in screen with lockout and remember-me

The web sign-in screen asks only for the password, can remember the browser for 30 days, and says when a session expired; signing in returns to the same view. Five wrong passwords from one address lock sign-in (and HTTP Basic) from there for 60 seconds, with a live countdown. Over plain HTTP to a non-loopback address the screen warns that the connection is not encrypted. A lost password can be reset on the host with `torrentx-server auth reset`.

#### Covers for media torrents and their files

A torrent's page and its row in the list now show its cover as a background, and the media view shows a thumbnail
per episode. The cover
comes from the torrent itself: a `poster.jpg` in its root, album art (`cover`, `folder`, `album`, `front`) for music,
or one frame of the video, captured in the browser through the stream link and stored on the server so every device
shows the same image. "Remove cover" in the header menu clears a wrong one for good.

An online lookup is available and off by default: Settings → Appearance → Covers takes your own TMDB API key and then
fetches a poster (and episode stills) by title. Only the title, year, season and episode number are sent.

API: `Torrent.cover` and `FileInfo.cover` hold a version string or `null`; images are at
`GET /torrents/{id}/cover` and `GET /torrents/{id}/files/{index}/cover`, with `PUT` / `DELETE` on the same paths
and `POST /torrents/{id}/cover/lookup`. Settings gain `covers {onlineLookup, hasApiKey}`.

Fixed: with rqbit, the files of a multi-file torrent had paths without the torrent's folder, so "Open" and "Reveal"
looked in the wrong place. File paths are now relative to the save path on both engines.

MKV and other files the browser's player rejects get a frame too: the UI decodes one itself, and a server with `ffmpeg` installed takes the frame from finished files, also for paused torrents.

#### Search files across torrents from Spotlight

Type `@` and Space in Spotlight to search the files of every torrent by name or with file fields (`ext:srt`,
`size:>1GB`, `s01e04`). In file search, `torrent:` and Space picks one torrent to search in; on a torrent's page the
search starts there. Results show the file's size, progress and priority with long names trimmed in the middle, and
Enter opens the torrent's Files section with the file highlighted. The new `GET /api/v1/files` endpoint lists every
torrent's files in one request.

#### `:field value` queries and editable tab chips

The query language also accepts the prefix form `:field value` (`:size >4GB`, `!:tag x`). It means the same as
`field:value`, works everywhere a query is typed, and Spotlight no longer rewrites `:size ` into `size:`.

The active tab's own query now leads the filter bar's chip row, counts in the funnel and appears in the filter
builder. Removing, negating or editing those chips changes only what the list shows: the saved tab stays as it is,
and Clear lens or switching tabs brings it back.

The "no torrents match" breakdown follows the design: an amber funnel icon, removable tab and lens chips (funnel
for the tab, check for the lens), and shortcuts on the recovery buttons. Clear lens also appears when only tab chips
were edited.

Tabs you create are edited in place: applying the filter builder, adding or removing a chip, or clicking a column header saves the new query to the tab (⌘Z undoes it), and "Save as tab" is no longer offered there. Built-in tabs keep the lens.

#### Settings is a page

Settings now open as a page with its own address (`#/settings/<section>`) instead of a modal with a Save button.
A section rail covers General, Engine, Network, Bandwidth, Queue & seeding, Folders, Tabs & query, Terminal &
security, Notifications, Appearance and About, and "Search settings" (⌘F) finds any row. Ordinary changes save as
you make them, row by row. Changes that restart the engine wait behind a "Restart required" notice. Access and login
changes wait for Apply. Unsupported options stay visible with "not supported by <engine>". The Network section adds a
port reachability test, a random port button, the DHT node count and a protocol encryption setting. Pasting a
`tx://settings/<section>` link into Spotlight opens that section.

#### Spotlight query mode: save, see matches, act on them

Typing a query like `state:active tag:4k` in Spotlight now draws it as tokens in the input and puts the query to
work: save it as a smart tab with an editable name (⌘S), see the first matching torrents and "Show all" in the All
tab (⇧⏎), jump to related tabs and to files whose names match, and pause (⌘P) or tag (⌘L) every matching torrent.
Tab still applies the query as a lens in the current tab.
While a query is unfinished (`size:`), Spotlight shows the parse error and suggests what comes next; typing `:`
lists the fields, and `:size` followed by a space becomes `size:`.

#### Categories, a tag picker, one-click details and a file tree

- A plain click on a torrent opens its page; ⌘-click and ⇧-click still select rows for bulk actions.
- Torrents have a category (`PUT /torrents/{id}/category`), and `category:` in queries now matches it.
- Tags and the category are edited in a dropdown picker opened from the row menu, the tags cell, the torrent page header or ⌘L: check existing tags, pick a category, or type a name to create one.
- The Files section shows files as a folder tree (folders fold, show totals and set wanted/priority for everything inside), with list and media views still available.
- Files get icons by type, like a file manager: video, audio, images, subtitles, text, documents, archives, disc images and more.
- Reorder and resize the list's columns: drag a header border to resize (double-click it for the default width), or open the button at the right end of the header (or "Reorder columns" in the palette) to drag columns into a new order; Reset there restores both. Order and widths are remembered in this browser.
- The paused, queued and checking state chips stay visible on a selected row.
- Sidebar tabs show icons by what they hold (All, Downloading, Active, Seeding, Stalled, movies, shows, music, books, disc images; a dashed circle for ad-hoc tabs), and the "Search or paste magnet" button fits on one line.
- Media view recognizes anime-style episode names (`Show - 01 [1080p].mkv`, `[Group] Show - 12v2.mkv`) and opens by default when a torrent is a season pack.
- Play works: a finished episode opens in your video player, and an unfinished one streams into it while it downloads (pieces near the playhead come first; embedded engine only). Pick the player in Settings → General (empty = IINA, VLC or mpv, whichever is installed). From another device, Play copies a stream link to paste into a player there.

### Fixes

- pen design
- collapse the whole filter bar; keep Spotlight placeholder readable
- refuse absolute and prefixed file paths in open/reveal
- double-clicking the window drag areas no longer selects text
- show the window on a Dock icon click
- point the update check at torrentx/torrentx releases
- count sign-in attempts before checking the password
- keep the row menu above the rows below it
- confirm the window URL reaches our own server before the login handoff

#### Desktop app starts on Windows when the port is free

The desktop app no longer reports "Port 9977 is used by another program" on Windows when nothing listens on the
port. A port Windows reserves for itself now gets a message that says how to check it. Development and build
scripts work from PowerShell and `cmd`, and releases offer stable download links for the latest version.

#### Torrent page: Files first, combined progress and speed block

A torrent opens on its Files section, now the first tab. The hero shows progress, the speed graph and the figures in
one block, and episode rows draw their own download graph. The top bar's "compact rows" and "filter bar" toggles
now act on the torrent page, a double click anywhere on the top bar maximizes the desktop window, a click on the
Dock icon brings the hidden window back, and the hero's ⋯ menu is no longer cut off by the section tabs.

#### Double-clicking the title bar no longer selects text

In the desktop window, double-clicking the empty top bar or sidebar head to maximize no longer leaves the filter bar
text selected.

#### New app icon

The desktop app, its tray entry and the installers now use the TorrentX terminal-prompt icon instead of the
default Tauri logo.
