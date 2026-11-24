---
default: major
---

# Torrent detail page

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
