# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Desktop Application with Tauri Desktop Framework

**Key Characteristics:**
- Desktop client built with React + TypeScript frontend
- Tauri framework for cross-platform desktop app bundling
- Modular backend architecture with pluggable torrent client implementations (Transmission, internal rqbit)
- Component-driven UI with local state management
- Separation between frontend (React) and backend (Rust)

## Layers

**Presentation Layer (Frontend):**
- Purpose: Render UI and handle user interactions
- Location: `src/components/`, `src/App.tsx`, `src/main.tsx`
- Contains: React components for tabs, torrent lists, settings, terminal, details panels
- Depends on: TorrentAPI (`src/lib/torrent-api.ts`), utilities (`src/lib/utils.ts`), Tauri API
- Used by: End users

**API Bridge Layer:**
- Purpose: Communicate between frontend and Tauri backend via IPC
- Location: `src/lib/torrent-api.ts`
- Contains: `TorrentAPI` class with async methods invoking Tauri commands
- Depends on: `@tauri-apps/api/tauri` invoke function, types from backend
- Used by: Components throughout the frontend

**Backend Service Layer:**
- Purpose: Abstract different torrent client implementations
- Location: `src-tauri/src/backend/`
- Contains: Trait definitions for `TorrentBackend`, implementations for Transmission RPC and rqbit
- Depends on: Tauri, external torrent client libraries
- Used by: Tauri command handlers (currently commented out in `lib.rs`)

**Type Definition Layer:**
- Purpose: Define domain models shared between frontend and backend
- Location: `src/lib/torrent-api.ts` (frontend types), `src-tauri/src/backend/mod.rs` (backend types)
- Contains: `TorrentInfo`, `TorrentStatus`, `Backend` enum, `DownloadOptions`
- Depends on: Serde for serialization
- Used by: All layers for type safety

## Data Flow

**User Adding a Torrent:**

1. User clicks "Add Torrent" button in `Header` component
2. `AddTorrent` modal opens with tab-based UI (URL/Magnet/File)
3. User enters magnet link or torrent file, configures options via `DownloadOptionsForm`
4. Submit triggers `torrentAPI.addTorrent(magnetOrUrl)` from `src/lib/torrent-api.ts`
5. TorrentAPI invokes Tauri command: `invoke("add_torrent", { magnetOrUrl })`
6. Tauri backend receives command in `lib.rs` (currently stubbed)
7. Command delegates to active backend (Transmission or Internal/rqbit)
8. Backend adds torrent and returns ID
9. Frontend updates mock torrents state

**User Browsing Torrents:**

1. `App` maintains `torrents` state (currently mock data in `TorrentList`)
2. User can switch tabs (All, Downloading, Completed, or custom tabs)
3. `TorrentList` filters torrents by `activeTabId` and `searchQuery` via `useMemo`
4. Filtered list is sorted by selected column (name, size, progress, etc.)
5. Each torrent renders as `TorrentItem` with progress bar and action buttons
6. User can select torrent to expand `TorrentDetails` panel

**User Managing Torrent:**

1. User clicks Play/Pause button on `TorrentItem`
2. Action calls `torrentAPI.pauseTorrent(id)` or `torrentAPI.resumeTorrent(id)`
3. TorrentAPI invokes corresponding Tauri command
4. Backend executes command on active client
5. Frontend re-fetches torrents via `torrentAPI.getTorrents()`

**State Management:**
- Frontend: React `useState` in `App.tsx` manages tabs, active tab, modal visibility, selected torrent, search query
- No global state manager (Redux, Zustand) currently in use
- Modal dialogs (Settings, Terminal, AddTorrent, TorrentDetails) use boolean flags in App state
- TorrentList maintains its own local sorting/filtering state and mock torrent data
- Backend: Planned but not yet implemented - would use Arc<Mutex<>> for shared state across commands

## Key Abstractions

**TorrentAPI Singleton:**
- Purpose: Encapsulate all communication with Tauri backend
- Examples: `src/lib/torrent-api.ts`
- Pattern: Single instance exported as `torrentAPI` constant; methods are async and return promises
- Interface: Methods like `getTorrents()`, `addTorrent(magnetOrUrl)`, `pauseTorrent(id)`, `removeTorrent(id)`

**Component Hierarchy:**
- Purpose: Organize UI into reusable, composable pieces
- Examples: `Header`, `TabBar`, `TorrentList`, `TorrentItem`, `TorrentDetails`, `Settings`, `AddTorrent`, `Terminal`, `StatusBar`
- Pattern: Functional components with props for data and callbacks; modals rendered conditionally in App
- Composition: App is root; Header, TabBar, TorrentList (with TorrentItem, TorrentDetails), StatusBar form main layout; modals (Settings, AddTorrent, Terminal) are conditional children

**Tab System:**
- Purpose: Allow users to organize torrents into custom categories
- Pattern: Each tab has `id` and `name`; torrents are filtered by `tabId` or status
- Built-in tabs: "all" (all torrents), "downloading" (active downloads), "completed" (finished torrents)
- Custom tabs: Created dynamically with unique timestamp-based IDs

**Backend Trait Pattern:**
- Purpose: Abstract different torrent client implementations
- Examples: `TorrentBackend` trait in `src-tauri/src/backend/mod.rs`
- Pattern: Trait defines interface; implementations (Transmission RPC, rqbit) provide concrete behavior
- Usage: Planned to switch backends via `set_backend()` command

## Entry Points

**Frontend Entry Point:**
- Location: `src/main.tsx`
- Triggers: Application launch
- Responsibilities: Bootstrap React application, render root App component to DOM

**Tauri Entry Point:**
- Location: `src-tauri/src/main.rs`
- Triggers: Application launch (Rust side)
- Responsibilities: Call `torrentx_app_lib::run()` to initialize Tauri builder and start event loop

**Tauri Backend Initialization:**
- Location: `src-tauri/src/lib.rs` in `run()` function
- Triggers: Application startup
- Responsibilities: Initialize Tauri builder with plugins (opener plugin), register command handlers (currently commented out), build and run the app

## Error Handling

**Strategy:** Try-catch at component level; promise rejection handling in TorrentAPI

**Patterns:**
- `TorrentAPI` methods return `Promise<T>` or throw errors
- Components do not currently implement error boundaries or error UI
- TorrentDetails, Settings, AddTorrent have no explicit error handling
- Backend trait methods return `Result<T, Box<dyn Error>>` for internal use

## Cross-Cutting Concerns

**Logging:** Not implemented; console.log statements exist in App.tsx (e.g., "Move torrent X to tab Y")

**Validation:** Minimal - AddTorrent validates file input format, download path is optional, magnet/URL syntax not validated

**Authentication:** Not implemented; backend supports basic auth for Transmission RPC (settings form UI exists but non-functional)

**Styling:** Tailwind CSS with custom dark theme colors (green terminal aesthetic); utility-first approach with inline class strings

**Responsive Design:** Uses Flexbox layout; assumes desktop window; not mobile-responsive

**Data Persistence:** None - all state is in-memory; settings are not persisted to disk; mock torrent data is hardcoded

