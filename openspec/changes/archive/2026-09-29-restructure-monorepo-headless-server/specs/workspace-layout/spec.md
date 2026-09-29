## Purpose

Defines the monorepo layout (apps, crates, packages) and the root commands developers use to build, run, and lint every part of TorrentX.

## ADDED Requirements

### Requirement: Monorepo directory layout
The repository SHALL organize code into three top-level groups: `apps/` for runnable applications (desktop app, web UI), `crates/` for Rust library and binary crates, and `packages/` for npm packages consumed by apps. No application source SHALL remain in the legacy root `src/` or `src-tauri/` directories.

#### Scenario: Layout after restructure
- **WHEN** a developer lists the repository root
- **THEN** `apps/`, `crates/`, and `packages/` exist, and `src/` and `src-tauri/` do not

### Requirement: Single Rust and JS workspace
All Rust crates (including the desktop app's Tauri crate) SHALL be members of one root Cargo workspace sharing a single lockfile, and all JS apps/packages SHALL be members of one pnpm workspace sharing a single lockfile.

#### Scenario: Workspace-wide Rust build
- **WHEN** a developer runs `cargo build --workspace` at the repo root after building the web UI
- **THEN** every crate compiles using the single root `Cargo.lock`

#### Scenario: Workspace-wide JS install
- **WHEN** a developer runs `pnpm install` at the repo root
- **THEN** dependencies for every app and package are installed with the single root `pnpm-lock.yaml`, and internal packages resolve via workspace links

### Requirement: Root developer commands
The root `package.json` SHALL provide scripts to: run the web UI dev server against a running server, run the headless server, run the desktop app in dev mode, build everything for release, and lint all JS/TS code.

#### Scenario: Lint from root
- **WHEN** a developer runs `pnpm lint` at the repo root
- **THEN** ESLint runs over all apps and packages and exits non-zero on lint errors

#### Scenario: Desktop dev from root
- **WHEN** a developer runs `pnpm dev:desktop`
- **THEN** the desktop app launches with its in-process server and a window showing the web UI
