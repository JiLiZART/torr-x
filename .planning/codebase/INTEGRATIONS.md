# External Integrations

**Analysis Date:** 2026-03-24

## APIs & External Services

**Transmission RPC (Optional):**
- Transmission BitTorrent daemon integration via RPC protocol
  - SDK/Client: `reqwest` HTTP client + custom RPC serialization in `src-tauri/src/backend/transmission.rs`
  - Protocol: HTTP POST to Transmission RPC endpoint
  - Configuration: Remote hostname, port, username/password (stored in Settings UI, not persisted yet)
  - Methods implemented: Add torrent, get torrents, pause, resume, remove, fetch info
  - RPC endpoint format: `http://{hostname}:{port}/transmission/rpc`
  - Authentication: Optional session-based auth with X-Transmission-Session-Id header

**Tracker Servers (Implicit):**
- BitTorrent tracker communication via librqbit
- DHT (Distributed Hash Table) for peer discovery
- No explicit SDK - handled by `librqbit` dependency during torrent operations

## Data Storage

**Databases:**
- Not currently implemented
- Settings stored in memory via React state (`src/components/Settings.tsx`)
- Torrents sourced from:
  - Internal: librqbit in-memory state
  - External: Transmission daemon (stateful)

**File Storage:**
- Local filesystem only
- Download directory: Configurable via Settings UI (path selector not fully implemented)
- Torrent metadata: Stored by librqbit or Transmission (not in TorrentX app)
- Configuration: In-memory during session (not persisted to disk)

**Caching:**
- React component state - Frontend caches torrent list, UI state
- librqbit internal caching of torrent metadata and peer data
- No explicit Redis/Memcached integration

## Authentication & Identity

**Auth Provider:**
- Custom implementation via Transmission RPC
  - Optional HTTP Basic Auth or session ID-based auth
  - Username/password input in Settings (`src/components/Settings.tsx` lines 20-21)
  - Session ID header: `X-Transmission-Session-Id` (handled in `src-tauri/src/backend/transmission.rs`)
- No user accounts or identity provider (desktop app, single user)

## Monitoring & Observability

**Error Tracking:**
- None detected
- Error handling: Try-catch in components, Result types in Rust

**Logs:**
- Console logging in React components (e.g., `console.log` in `src/App.tsx` line 105)
- Rust logging not configured (no log crate dependency)
- Terminal component (`src/components/Terminal.tsx`) displays app output but not persisted

## CI/CD & Deployment

**Hosting:**
- Desktop application (not web-based)
- Distributed via Tauri bundles for macOS/Windows/Linux
- GitHub releases or direct binary distribution (not configured)

**CI Pipeline:**
- None detected (no GitHub Actions, GitLab CI, or similar)
- Manual build process: `pnpm build` then `pnpm tauri build`

## Environment Configuration

**Required env vars:**
- None explicitly required at runtime
- Optional Transmission RPC endpoint (can be set in UI Settings)
  - `remoteHostname`: Defaults to `localhost`
  - `remotePort`: Defaults to `9091`
  - `remoteUsername`: Empty by default
  - `remotePassword`: Empty by default

**Secrets location:**
- No secrets management implemented
- Transmission credentials stored in React component state (not persisted)
- No .env file configured or used

## Webhooks & Callbacks

**Incoming:**
- None detected
- Torrent events triggered via UI actions:
  - Add torrent (magnet link or .torrent file)
  - Pause/resume operations
  - Settings changes

**Outgoing:**
- None currently implemented
- Planned: Transmission RPC POST requests (HTTP API calls, not webhooks)
- File opener callback: `tauri-plugin-opener` for opening downloaded files

## BitTorrent Network Integration

**Magnet Link Handling:**
- Frontend: `AddTorrent` component accepts magnet link input (`src/components/AddTorrent.tsx`)
- Backend: Passed to `librqbit` or Transmission via `add_torrent()` IPC command
- Protocol: `magnet:?xt=urn:btih:...` parsed by BitTorrent engine

**Torrent File Handling:**
- Frontend: File upload UI (not fully implemented, shows placeholder)
- Backend: librqbit processes .torrent file, extracts metadata
- Local storage: Downloaded to configured directory

**Peer Discovery:**
- librqbit: DHT, tracker announces
- Transmission: Tracker communication, PEX (Peer Exchange)

## System Integration

**File Opener:**
- tauri-plugin-opener: Opens downloaded files in default application
- Triggered from completed torrent context menu (planned)

**Window Management:**
- Tauri: 800x600 window, no decorations (borderless)
- Window config: `src-tauri/tauri.conf.json` lines 12-19

---

*Integration audit: 2026-03-24*
