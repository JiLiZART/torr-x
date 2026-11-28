## MODIFIED Requirements

### Requirement: Root developer commands
The root `package.json` SHALL provide scripts to: run the web UI dev server against a running server, run the headless server, run the desktop app in dev mode, build everything for release, and lint all JS/TS code. It SHALL also provide one desktop build script per release platform (`build:desktop:macos` for a universal macOS app, `build:desktop:windows` for Windows x64, `build:desktop:linux` for Linux x64), plus `build:server` for the host platform. Every root script SHALL run unchanged from bash, zsh, Windows `cmd` and PowerShell, without a POSIX shell, WSL or Git Bash. Release CI SHALL build with these same scripts.

#### Scenario: Lint from root
- **WHEN** a developer runs `pnpm lint` at the repo root
- **THEN** ESLint runs over all apps and packages and exits non-zero on lint errors

#### Scenario: Desktop dev from root
- **WHEN** a developer runs `pnpm dev:desktop`
- **THEN** the desktop app launches with its in-process server and a window showing the web UI

#### Scenario: Desktop dev on Windows
- **WHEN** a developer runs `pnpm dev:desktop` from PowerShell or `cmd` on Windows
- **THEN** the desktop app launches and its window loads the UI from the Vite dev server, with no shell syntax error

#### Scenario: Windows installer from root
- **WHEN** a developer runs `pnpm build:desktop:windows` on Windows
- **THEN** the build downloads the GeoIP database, builds the web UI and produces the MSI and setup executable

#### Scenario: Universal macOS build
- **WHEN** a developer runs `pnpm build:desktop:macos` on macOS with both Apple Rust targets installed
- **THEN** a universal disk image is produced
