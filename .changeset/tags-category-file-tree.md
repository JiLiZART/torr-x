---
default: minor
---

# Categories, a tag picker, one-click details and a file tree

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
