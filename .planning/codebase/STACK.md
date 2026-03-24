# Technology Stack

**Analysis Date:** 2026-03-24

## Languages

**Primary:**
- TypeScript 5.9.3 - Frontend UI components and IPC bridge
- Rust 2021 edition - Desktop backend, BitTorrent engine, and system integration

**Secondary:**
- JavaScript - Configuration files (Vite, Tailwind, PostCSS, ESLint)
- HTML/CSS - Index markup and Tailwind-generated styles

## Runtime

**Environment:**
- Node.js (implied by package.json, exact version unspecified)
- Rust target: macOS, Windows, Linux (bundled by Tauri)

**Package Manager:**
- pnpm - Configured via `pnpm-lock.yaml` lock file
- Lockfile: Present (`pnpm-lock.yaml`, `Cargo.lock`)

## Frameworks

**Core:**
- React 19.2.0 - UI component framework
- Tauri 2 - Desktop application framework wrapping Rust backend and web frontend

**Build/Dev:**
- Vite 7.1.12 - Frontend bundler and dev server
- @vitejs/plugin-react 5.1.0 - React JSX transformation plugin
- TypeScript 5.9.3 - Type checking (compiled before Vite)

**Styling:**
- Tailwind CSS 3.4.17 - Utility-first CSS framework
- PostCSS latest - CSS transformation pipeline
- Autoprefixer latest - Vendor prefix insertion

**Desktop/Native:**
- @tauri-apps/api ^2 - IPC bridge to invoke Rust commands
- @tauri-apps/plugin-opener ^2 - Open files/URLs from Rust backend
- @tauri-apps/cli ^2 - Development and build tooling
- tauri-build 2 - Rust side build setup
- tauri-plugin-opener 2 - Tauri file opener plugin

**UI Components:**
- lucide-react 0.522.0 - Icon library (SVG-based)
- clsx 2.1.1 - Conditional className utility
- tailwind-merge 3.3.1 - Tailwind class conflict resolution

## Key Dependencies

**Frontend - Critical:**
- react 19.2.0 - Core framework
- react-dom 19.2.0 - React DOM rendering
- @tauri-apps/api ^2 - IPC communication to Rust backend (essential for torrent operations)

**Frontend - UI:**
- lucide-react 0.522.0 - Icon system (40+ icons used for UI)
- clsx 2.1.1 - Dynamic className composition
- tailwind-merge 3.3.1 - Safe Tailwind class merging

**Rust - BitTorrent:**
- librqbit 8.1.1 - Pure Rust BitTorrent client library (embedded torrent engine)
- tokio 1.0 with full features - Async runtime for concurrent operations
- async-trait 0.1 - Async trait definitions

**Rust - HTTP/Serialization:**
- reqwest 0.11 with json feature - HTTP client for Transmission RPC
- serde 1 with derive feature - Serialization framework
- serde_json 1 - JSON support
- thiserror 2.0.17 - Error type derivation macro

**Rust - Plugin/System:**
- tauri-plugin-opener 2 - File/URL opener integration
- tauri 2 - Core framework (from dependencies)

## Development Dependencies

**Linting & Type Checking:**
- @typescript-eslint/eslint-plugin 8.46.2 - TypeScript rule set
- @typescript-eslint/parser 8.46.2 - TypeScript parser
- eslint ^8.50.0 - Linting framework
- eslint-plugin-react-hooks ^4.6.0 - React hooks rules
- eslint-plugin-react-refresh ^0.4.1 - Fast refresh validation

**Type Definitions:**
- @types/react 19.2.2 - React type definitions
- @types/react-dom 19.2.2 - React DOM types
- @types/node ^20.11.18 - Node.js types (for build scripts)

## Configuration

**Environment:**
- Development: `pnpm dev` runs Vite on port 1420 (configured in `vite.config.ts`)
- Full app: `pnpm tauri dev` runs Tauri dev mode
- No `.env` file detected; settings managed via:
  - React component state (`src/components/Settings.tsx`)
  - Tauri configuration (`src-tauri/tauri.conf.json`)
  - Potential Transmission RPC endpoint in settings (hostname, port, auth)

**Build:**
- `package.json` scripts:
  - `dev`: Vite development server
  - `build`: TypeScript check + Vite bundle
  - `preview`: Preview production build
  - `tauri`: Direct Tauri CLI invocation
- `src-tauri/Cargo.toml` with release optimizations:
  - `codegen-units = 1` for better optimization
  - `lto = true` for link-time optimization
  - `opt-level = "s"` for binary size priority
  - `panic = "abort"` for performance
  - `strip = true` removes debug symbols

**Frontend Configuration Files:**
- `vite.config.ts` - Port 1420, path alias `@` → `src`, Tauri-specific settings
- `tsconfig.json` - ES2020 target, strict mode, DOM/DOM.Iterable libs
- `tsconfig.node.json` - Build tool types
- `tailwind.config.js` - Dark mode selector, custom HSL color system
- `postcss.config.js` - Tailwind + Autoprefixer pipeline
- `.eslintrc.cjs` - React Hooks + TypeScript strict rules

**Desktop Application Configuration:**
- `src-tauri/tauri.conf.json` - Window: 800x600, no decorations, app identifier `org.torrenthx.app`

## Platform Requirements

**Development:**
- Node.js (version unspecified, pnpm as package manager)
- Rust toolchain (implicit from Cargo.toml)
- macOS, Windows, or Linux

**Production:**
- Tauri bundles native binaries for:
  - macOS (x64 and ARM)
  - Windows (MSVC)
  - Linux (AppImage/Deb)
- Single executable after `pnpm tauri build`

---

*Stack analysis: 2026-03-24*
