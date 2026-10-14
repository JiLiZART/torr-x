# TorrentX

A torrent client with a terminal-style web UI. One server, two ways to run it:

- **Desktop app** (macOS / Windows / Linux): a tray app. It runs the TorrentX server
  inside its own process and shows the web UI in a window. Click the tray icon to
  show or hide it, or open `http://localhost:9977` in any browser.
- **Headless server** (`torrentx-server`): a single binary for a Linux box. It runs
  as a systemd service; you manage it from a browser or over the HTTP API.
  See [docs/linux-service.md](docs/linux-service.md).

Engines: the built-in **rqbit** engine (no external daemon), or an existing
**Transmission** daemon over RPC. You pick one in Settings.

## Download

Grab a build from [Releases](https://github.com/JiLiZART/torr-x/releases):

- `torrentx-server-<version>-linux-{x86_64,aarch64}.tar.gz`: headless server, systemd unit and install guide
- `TorrentX_<version>_universal.dmg` (macOS), `_x64_en-US.msi` / `_x64-setup.exe` (Windows),
  `_amd64.AppImage` / `_amd64.deb` (Linux): desktop app
- `SHA256SUMS.txt`: verify with `sha256sum -c SHA256SUMS.txt`

Builds are not code-signed yet. On macOS, right-click the app and choose **Open** the first time (or run
`xattr -d com.apple.quarantine /Applications/TorrentX.app`); on Windows, choose **More info → Run anyway**.
The [`nightly`](https://github.com/JiLiZART/torr-x/releases/tag/nightly) pre-release is rebuilt from every push to `main`.

## Quick start

```bash
pnpm install

pnpm dev:desktop        # desktop app (in-process server + tray + window)
pnpm dev:server         # headless server on http://127.0.0.1:9977
pnpm dev:web            # Vite dev UI on :1420, proxies /api to the server above
```

If a TorrentX server is already running on the configured port (e.g. the
system service), the desktop app attaches to it instead of starting its own.

## Configuration

A single TOML file, created with defaults on first start:

| Platform | Path |
| --- | --- |
| macOS | `~/Library/Application Support/torrentx/config.toml` |
| Linux | `~/.config/torrentx/config.toml` (service: `/etc/torrentx/config.toml`) |
| Windows | `%APPDATA%\torrentx\config.toml` |

By default the server binds to `127.0.0.1:9977` with no authentication. You
can enable a username/password and change the bind address in **Settings**.
Even without auth, the server rejects requests with a foreign `Host` header
(DNS rebinding) and cross-site writes (CSRF).

## Build

```bash
pnpm build:server       # target/release/torrentx-server (UI embedded)
pnpm build:desktop      # Tauri bundle
pnpm lint
cargo test --workspace
```

## Contributing and releases

Each user-facing pull request adds one change file to `.changeset/` describing the change for the release notes:

```markdown
---
default: minor   # major | minor | patch
---

# Short user-facing title

Optional details.
```

Create it with `knope document-change` ([install Knope](https://knope.tech/installation/)) or by hand. The CI `changes`
check fails without one, unless every commit is a conventional commit such as `ci:` or `docs:`. Merged change files
collect on `main`; a workflow keeps a `release` PR open with the next version and changelog, and merging it builds the
binaries and publishes the versioned release.

## Layout

```
apps/web                React UI (served by the server)
apps/desktop            Tauri shell (tray + window)
crates/torrentx-core    shared torrent model
crates/torrentx-rqbit   librqbit engine
crates/torrentx-transmission  Transmission RPC engine
crates/torrentx-server  HTTP API + UI hosting (lib + torrentx-server bin)
packages/api-client     typed TS client for /api/v1
packaging/systemd       systemd unit
```
