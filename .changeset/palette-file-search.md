---
default: minor
---

# Search files across torrents from Spotlight

Type `@` and Space in Spotlight to search the files of every torrent by name or with file fields (`ext:srt`,
`size:>1GB`, `s01e04`). In file search, `torrent:` and Space picks one torrent to search in; on a torrent's page the
search starts there. Results show the file's size, progress and priority with long names trimmed in the middle, and
Enter opens the torrent's Files section with the file highlighted. The new `GET /api/v1/files` endpoint lists every
torrent's files in one request.
