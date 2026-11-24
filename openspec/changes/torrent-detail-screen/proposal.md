## Why

Screens 09–12 (`pen/untitled.pen`, `YpnAn`, `U264ly`, `SeBYT`, `xfkVA`) define the torrent detail view: a page
with browser back, a status hero, six counted sections, a mini filter bar per section speaking the same query
language, Files that can present a season as episodes, and Peers / Trackers / Web seeds tables with the
columns the engines can actually report. Today details are a panel under the list with unfilterable tables.
This change implements the four screens **from the ground up**, including the model and endpoint work they
need.

**Replaces** the former pending `torrent-detail-page` change (same screens, board-derived; removed).

## What Changes

- **Detail is a page**: breadcrumb `← <tab> ⌘[` / `<name>`; back restores the list's scroll position and lens
  exactly; each section has its own address. **BREAKING (UI)**: the under-list panel is removed; Enter or
  double-click opens a torrent (single click selects).
- **Status hero**: format icon, name, meta line (state word · size · file count · tracker · added · btih ·
  save path), actions Pause/Resume, Verify, Reveal, Remove, overflow; big progress % and stat strip:
  progress, transferred (`28.7 GB of 42.1 GB`), eta, down, up, seeds (`48 of 112`), peers (`12 of 31`), ratio.
- **Sections with counts**: Overview, Files (18), Peers (48), Trackers (6), Web seeds (2), Pieces. Every
  section has a mini filter bar — same parser, chips, sort chip, shown-of-total count — with section-scoped
  fields; a section lens is scoped to that section and never saved.
- **Files (screen 09)**: `format: generic` label + view switcher; columns NAME · SIZE · DONE · PRIORITY ·
  ACTIONS; wanted checkbox, type icon, priority menu (high/normal/low/skip). Row actions follow the file
  format: video → play / add to library / cast; iso + archive → show contents / mount; everything else →
  open / reveal / copy path. Fields `ext: priority: ep: season:`.
- **Files in media mode (screen 10)**: when video files parse as episodes, `format: video · media mode` with
  a Media view switcher: SEASON picker, EPISODES strip (dashed = hidden by the lens), one row per episode —
  `S02E04`, title and duration only if known, quality tags (2160p · DV · HDR10 · DDP5.1 Atmos), size,
  progress, state word (ready to play / downloading / queued / skipped), actions Play / Library / Cast /
  overflow, and a featured "Play S02E04" button. Switchable back to the plain list; nothing invented.
- **Peers (screen 11)**: columns IP:PORT · COUNTRY (code + name) · CLIENT · PROGRESS · DOWN · UP · FLAGS ·
  ENC; flag letters D/U/X/I/E/K/S/? with a legend; fields `country: client: flags:`; count
  `48 of 112 peers · lens scoped to this section`.
- **Trackers + Web seeds (screen 12)**: Trackers — header `6 announced · 1 failing`, Add tracker; columns
  URL · TIER · STATUS · SEEDS · LEECH · DOWNLOADED · LAST · NEXT; statuses working / updating… / not working;
  failing rows show the reason and a re-announce action; DHT/PeX appear as pseudo-rows (tier —). Web seeds —
  `2 configured · 1 failing`, Add web seed; columns URL · TYPE (BEP 19 / BEP 17) · STATUS · SPEED ·
  DOWNLOADED; failure reasons shown. Gated by capabilities.
- **Model/API**: `Tracker` gains tier/kind/leechers/downloaded/error/last/next; `Peer` gains flags +
  encryption; `TorrentDetails` gains `webSeeds`; endpoints for re-announce, add web seed, per-file
  open/reveal; capability keys `webSeeds`, `addWebSeed`, `reannounce`, `openFile`.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `web-ui`: detail page, hero, section filter bars, Files + media mode, Peers, Trackers, Web seeds.
- `http-api`: detail action endpoints and extended detail model.
- `torrent-engine`: extended tracker/peer/web-seed detail in the engine-agnostic model.
- `engine-capabilities`: new feature keys.

## Impact

- `packages/ui`: new `detail/` (`DetailPage`, `Hero`, `SectionTabs`, `FilesSection`, `MediaView`,
  `PeersSection`, `TrackersSection`, `WebSeedsSection`, `PiecesSection`, `OverviewSection`, `MiniFilterBar`);
  `TorrentDetails.tsx` removed; `lib/media.ts` (episode/quality parsing, pure, `node --test`).
- `packages/query`: evaluation against file/peer/tracker/web-seed rows; section fields in the registry.
- `crates/torrentx-core`: model extensions; drift fixture + `packages/api-client` together.
- `crates/torrentx-rqbit` / `-transmission`: fill new fields where available, `null` otherwise.
- `crates/torrentx-server/src/api.rs`: `POST /torrents/{id}/reannounce`, `POST /torrents/{id}/web-seeds`,
  `POST /torrents/{id}/files/{index}/open` and `/reveal`.
- i18n keys in six dictionaries. Depends on `active-tab-screen` (shell, query, lens, back/forward).
