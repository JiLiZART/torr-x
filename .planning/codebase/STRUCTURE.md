# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
torrentx-app/
├── src/                       # React frontend source code
│   ├── components/            # React UI components
│   ├── lib/                   # Shared utilities and API layer
│   ├── assets/                # Static assets (icons, images)
│   ├── App.tsx                # Root application component
│   ├── main.tsx               # Application entry point
│   ├── index.tsx              # Legacy entry point (duplicate)
│   ├── index.css              # Tailwind CSS setup
│   └── vite-env.d.ts          # Vite environment type definitions
│
├── src-tauri/                 # Tauri desktop framework backend
│   ├── src/                   # Rust source code
│   │   ├── backend/           # Torrent backend implementations
│   │   ├── lib.rs             # Tauri app initialization
│   │   └── main.rs            # Application entry point
│   ├── capabilities/          # Tauri security capabilities (scopes)
│   ├── gen/                   # Generated Tauri files (schemas, types)
│   ├── icons/                 # App icons for different platforms
│   ├── Cargo.toml             # Rust dependencies
│   └── tauri.conf.json        # Tauri configuration
│
├── public/                    # Static files served by frontend
├── .planning/                 # Documentation and planning files
├── .claude/                   # Claude-specific configuration
├── .vscode/                   # VS Code settings
│
├── package.json               # Node.js dependencies and scripts
├── pnpm-lock.yaml             # Lock file for pnpm package manager
├── vite.config.ts             # Vite bundler configuration
├── tsconfig.json              # TypeScript compiler configuration
├── tailwind.config.js         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
├── .eslintrc.cjs              # ESLint configuration
└── index.html                 # HTML entry point
```

## Directory Purposes

**src/:**
- Purpose: All React frontend TypeScript source code
- Contains: Components, utilities, API layer, styles
- Key files: `App.tsx` (root), `main.tsx` (entry), components directory

**src/components/:**
- Purpose: Reusable React UI components
- Contains: Functional components for UI sections and modals
- Key files: Header, TabBar, TorrentList, TorrentItem, TorrentDetails, Settings, AddTorrent, Terminal, StatusBar

**src/lib/:**
- Purpose: Shared utilities and service layer
- Contains: API bridge to Tauri backend, helper utilities
- Key files: `torrent-api.ts` (main API class), `utils.ts` (Tailwind class merging)

**src/assets/:**
- Purpose: Static images and icon assets
- Contains: Application icons and graphics
- Generated or: No

**src-tauri/src/:**
- Purpose: Rust backend code for desktop app functionality
- Contains: Tauri initialization, backend service implementations
- Key files: `lib.rs` (setup), `main.rs` (entry), backend modules

**src-tauri/src/backend/:**
- Purpose: Pluggable torrent client implementations
- Contains: Trait definitions and implementations for Transmission and rqbit
- Key files: `mod.rs` (trait definitions), `transmission.rs`, `rqbit.rs`

**src-tauri/capabilities/:**
- Purpose: Security scopes and permissions for Tauri app
- Contains: JSON files defining what the app can access
- Note: Tauri uses capability-based security

**src-tauri/gen/:**
- Purpose: Auto-generated files by Tauri CLI
- Contains: TypeScript types, schemas, bindings
- Note: Do not edit manually; generated from Cargo.toml

**public/:**
- Purpose: Static files copied to dist during build
- Contains: Favicon, public assets
- Served: At root of built app

**.planning/codebase/:**
- Purpose: Architecture and codebase documentation
- Contains: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md
- Committed: Yes, for team reference

## Key File Locations

**Entry Points:**
- `index.html`: HTML template for web app, references root div with id="root"
- `src/main.tsx`: Creates React root and renders App component
- `src-tauri/src/main.rs`: Tauri process entry point, calls lib.rs

**Configuration:**
- `vite.config.ts`: Bundler config with React plugin, Tauri-specific settings, path alias `@` for `src/`
- `tsconfig.json`: Strict TypeScript configuration for ES2020 target
- `tailwind.config.js`: Tailwind CSS setup (no custom theme overrides visible)
- `package.json`: Node dependencies and npm scripts (dev, build, preview, tauri)

**Core Logic:**
- `src/App.tsx`: State management for tabs, modals, selected torrent, search; layout composition
- `src/lib/torrent-api.ts`: API class singleton for Tauri backend communication
- `src-tauri/src/lib.rs`: Tauri builder initialization and command handler registration

**Components - Layout:**
- `src/components/Header.tsx`: Top bar with logo, search, action buttons
- `src/components/TabBar.tsx`: Tab switcher and creator
- `src/components/StatusBar.tsx`: Bottom status display
- `src/components/Sidebar.tsx`: Sidebar component (present but usage unclear)

**Components - Main Content:**
- `src/components/TorrentList.tsx`: Main table of torrents with sorting and filtering
- `src/components/TorrentItem.tsx`: Row component for each torrent
- `src/components/TorrentDetails.tsx`: Expandable details panel with tabs (info, files, peers, trackers)

**Components - Modals:**
- `src/components/AddTorrent.tsx`: Modal for adding new torrents (magnet/URL/file)
- `src/components/Settings.tsx`: Settings modal with tabs (general, network, downloads, remote, appearance, advanced)
- `src/components/Terminal.tsx`: Terminal emulation component
- `src/components/DownloadOptionsForm.tsx`: Reusable form for download preferences

**Testing:**
- `src/components/mock_data.ts`: Mock data for peers, seeds, trackers (used in TorrentDetails)

## Naming Conventions

**Files:**
- PascalCase for component files: `Header.tsx`, `TorrentList.tsx`, `DownloadOptionsForm.tsx`
- kebab-case for utilities and configs: `torrent-api.ts`, `vite-env.d.ts`, `postcss.config.js`
- Index files: No barrel exports; components are imported individually

**Directories:**
- lowercase for structural directories: `src/`, `lib/`, `components/`, `backend/`
- PascalCase not used for directories

**Functions and Variables:**
- Functional components use PascalCase: `function Header()`, `export function TorrentList()`
- Variables and hooks use camelCase: `const [torrents, setTorrents]`, `const activeTabId`
- Props interfaces use PascalCase with Props suffix: `HeaderProps`, `TorrentListProps`, `TabBarProps`
- Type definitions use PascalCase: `Tab`, `Torrent`, `TorrentInfo`, `Backend`, `TorrentStatus`

**Constants:**
- UPPER_SNAKE_CASE for compile-time constants (none observed)
- camelCase for object exports: `torrentAPI`, `peers`, `seeds`, `trackers`

## Where to Add New Code

**New Feature:**
- Primary code: `src/components/` for UI components
- Logic/API: `src/lib/` for utility functions or API methods
- Backend: `src-tauri/src/backend/` if new torrent client support needed
- Styling: Inline Tailwind classes in components using `className` prop

**New Component/Module:**
- Implementation: Create file in `src/components/` named `ComponentName.tsx`
- Export: Use named export `export function ComponentName() { ... }`
- Integration: Import in `App.tsx` and add to component tree or modal system
- Props: Define interface `ComponentNameProps` and use as component parameter type

**Utilities:**
- Shared helpers: Add to `src/lib/utils.ts` or create new file `src/lib/name.ts`
- API methods: Extend `TorrentAPI` class in `src/lib/torrent-api.ts` with new async method
- Tauri invokes: Add command handler in `src-tauri/src/lib.rs` (currently commented out)

**Backend Functionality:**
- New torrent client: Create implementation file `src-tauri/src/backend/newclient.rs`
- Implement `TorrentBackend` trait from `src-tauri/src/backend/mod.rs`
- Register in `Backend` enum and backend selection logic

**Styling:**
- Use Tailwind classes directly in component `className` attributes
- Color scheme: Green on black (`bg-black`, `text-green-500`, `border-green-900/30`)
- Spacing and layout: Use Tailwind utilities (flex, gap, p-4, etc.)
- Custom CSS: Add to `src/index.css` only if Tailwind utilities insufficient

## Special Directories

**node_modules/:**
- Purpose: Installed npm packages
- Generated: Yes, created by `pnpm install`
- Committed: No (listed in .gitignore)

**src-tauri/target/:**
- Purpose: Rust build artifacts and compiled binaries
- Generated: Yes, created by `cargo build`
- Committed: No (listed in .gitignore)

**.planning/codebase/:**
- Purpose: Auto-generated architecture documentation
- Generated: No, manually maintained
- Committed: Yes

**.claude/:**
- Purpose: Claude-specific settings and context
- Generated: Possibly by Claude tools
- Committed: Yes

