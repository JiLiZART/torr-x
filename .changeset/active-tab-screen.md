---
default: major
---

# Tabs are saved queries: new sidebar, filter bar and query language

The home screen is rebuilt around one query language (`state:active tag:4k size:>4GB sort:ratio desc`). Tabs live
in a left sidebar and are saved queries with live match counts; a per-tab lens adds removable filter chips, a
filter builder and "Save as tab". Torrents carry tags instead of belonging to one tab, and the list shows state,
tags, ratio and tracker columns.

Breaking API changes: `Tab` is now `{id, name, query, order, pinned, group}` and `GET /tabs` returns
`{grammarVersion, tabs}`; `Torrent.tabId` is replaced by `Torrent.tags` (plus a new `Torrent.tracker`);
`PUT /torrents/{id}/tab` answers 410, use `PUT /torrents/{id}/tags`. Existing `state.json` files migrate on
first start: each old tab keeps its torrents through a `tag:<name>` query.
