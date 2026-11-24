# End-to-end results (2026-09-29)

Setup: debug `torrentx-server` on an isolated HOME/port (9988), Chromium via Playwright; Transmission
4.0.6 daemon (rpc-version 17) on a scratch config (port 9191). Release `TorrentX.app` smoke-launched on an
isolated HOME/port (9989).

## Browser — rqbit

| Area | Result |
|---|---|
| Layout, header, tab bar, list columns, ASCII empty state, status bar (rates, ratio, disk free, CPU, MEM, counts) | ✓ |
| Add → magnet → preview (name, size, files, hash, pieces × size, trackers) → deselect 2 files → add | ✓ (fixed: whole row toggles selection, as in vendor) |
| Priority in Add dialog | disabled, "Not supported by rqbit" ✓ |
| Details: General (info rows, speed graph, piece map), Files (tree, Skip → `wanted=false`, wantedSize shrinks), priority items disabled | ✓ |
| Tabs: create, double-click rename, drag torrent onto tab, persisted in `state.json` | ✓ |
| Row menu: rename (display override, reflected in list + magnet + .torrent name), copy magnet, save .torrent, move data (progress/tab/name kept), verify, remove & erase (in-page confirm, data deleted, metadata forgotten) | ✓ (fixed: .torrent filename uses display name) |
| Terminal: list, pause by id prefix, status, unknown command | ✓ |
| Settings: Network gating (max connections, HTTP/SOCKS4 disabled), 100 KB/s limit applied live (observed avg ~74 KB/s), lifted live | ✓ |
| Settings: language → Deutsch and theme → Light apply without reload; saved to config | ✓ (fixed: "saved" message now follows the new language) |
| Browser notifications: "added" and "finished" each fired exactly once | ✓ |
| Update check with no published releases | silent (fixed: 404 no longer logged as a failure) |

## Browser — Transmission

| Area | Result |
|---|---|
| Remote: Test connection fails on a wrong port without saving; succeeds on the right one | ✓ |
| Engine switch from Settings → Server, live; capabilities follow (sequential download off on rpc 17) | ✓ |
| Add .torrent file: preview, skip file, start paused, priority High | ✓ |
| File priority High, add tracker, rename on disk, verify, reveal (loopback), peers, pieces, .torrent download | ✓ |
| Save path default when the setting is empty | fixed: left empty (the daemon's default folder), since the daemon may be on another host |

## Desktop (release bundle)

| Area | Result |
|---|---|
| `pnpm build:desktop` (GeoIP embedded) → TorrentX.app + DMG | ✓ |
| Frameless window with vendor header dots, in-process server | ✓ (screenshot) |
| Autostart login item, start minimized, quit confirmation (manual, user) | ✓ |
| Dots (hide / minimize / maximize), header drag, double-click maximize (manual, user) | ✓ |
| Native notification while hidden ("Download finished: …") | ✓ on retest. The first test showed nothing, and `org.torrenthx.app` had never registered with Notification Center. A standalone post registered it, and later notifications arrived. Likely cause: macOS drops the very first post from a not-yet-registered app. Not proven. |
| Desktop window under Transmission (manual, user) | ✓ |

## Follow-up fixes

- Speed values changed width ("757.2 KB/s" → "1.0 MB/s") and shifted the header and status bar.
  `rate()` now always returns 10 characters padded with NBSP (units switch at 1000); covered by `format.test.ts`.

## Not supported by any engine (disabled with a hint, as specified)

OS cache, super seeding, anonymous mode, WebSocket trackers, HTTP and SOCKS4 proxy.
