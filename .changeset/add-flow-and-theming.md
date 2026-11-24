---
default: major
---

# Add torrents from Spotlight, and light / dark themes with an accent

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
