## Why

Development and builds only work from a POSIX shell. On Windows, `pnpm dev:desktop` sets an environment variable with
shell syntax that `cmd`/PowerShell reject. The desktop app also reports "Port 9977 is used by another program" when
nothing listens on the port. `build:server` / `build:desktop` call a `.sh` script. CI works around this by spelling the
build steps out. Release publishing is split over three workflows (`build.yml`, `nightly.yml`, `release.yml`). The
release PR's CI stays at "action_required" without a token. The maintainer's other project (2fau-app) uses one simpler
release workflow, and this change adopts that model.

## What Changes

- Add `cross-env` as a root dev dependency. Root scripts that set environment variables use it, so every root
  `pnpm` script runs unchanged in bash, zsh, `cmd` and PowerShell.
- Replace `scripts/fetch-geoip.sh` with a Node script (`scripts/fetch-geoip.mjs`, no new dependencies), so it runs on
  every OS.
- Add per-platform build scripts: `build:desktop:macos` (universal), `build:desktop:windows` (x64),
  `build:desktop:linux` (x64), and `build:server` for the host. CI calls exactly these scripts.
- Fix the false "port is used by another program" error on Windows. A failed or slow connection while probing
  `/api/v1/health` no longer counts as a foreign program. The app tries to start its own server, and reports the
  port as taken only when something answers that is not TorrentX, or when binding fails because the port is in use.
  A port inside a Windows reserved range (Hyper-V/WinNAT) gets its own message, which says how to check for it.
- **BREAKING (CI/release)**: replace `build.yml` + `nightly.yml` + `release.yml` with one `release.yml` modelled on
  2fau-app. It runs on push to `main`, on push of `v*` tags and on `workflow_dispatch`:
  - a `knope release` job on `main` creates the tag and the release when the release PR was merged;
  - the rolling `nightly` pre-release is rebuilt on every other push to `main`;
  - every release is drafted, filled and only then published;
  - desktop installers are built with the `build:desktop:*` scripts (macOS universal, Windows x64, Linux x64), and
    only a final publish job, which runs no builds, can write to releases;
  - Linux server tarballs (x86_64, aarch64) are built and uploaded to the same release;
  - tagged releases get stable asset names (`TorrentX-macos-universal.dmg`, …) for
    `releases/latest/download/<name>` links, plus `SHA256SUMS.txt`.
- The release PR is opened with `secrets.RELEASE_TOKEN || github.token`, so the PR runs CI when the token is set.
  The release itself is built in the same run that creates the tag, so it never depends on a tag-push trigger.
- `prepare-release.yml` (the Knope release PR) and `ci.yml` stay, and `ci.yml` uses the new scripts.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `workspace-layout`: "Root developer commands" must work on macOS, Linux and Windows shells and include
  per-platform build commands.
- `desktop-app`: "Attach to existing server" reports a taken port only on evidence (a non-TorrentX answer or a bind
  that fails as in use), never because of a slow or refused connection. Reserved Windows ports get a specific message.
- `release-process`: "Versioned release" is built by the single release workflow with stable asset names, and
  "Rolling nightly pre-release" is rebuilt by the same workflow and never cancels a version build. This capability is introduced by the
  unarchived `ci-release-pipeline` change, which has to be archived (its spec synced) before this one.

## Impact

- `package.json` (scripts, `cross-env` dev dependency), `pnpm-lock.yaml`, `scripts/fetch-geoip.sh` replaced by
  `scripts/fetch-geoip.mjs`.
- `apps/desktop/src-tauri/src/lib.rs` (`probe` / `connect`), `crates/torrentx-server/src/lib.rs` (a `StartError`
  variant for a reserved or forbidden port).
- `.github/workflows/`: `build.yml` and `nightly.yml` removed, `release.yml` rewritten, `ci.yml` and
  `prepare-release.yml` touched. `knope.toml` (`assets`).
- Docs: `README.md` (download links: `releases/latest/download/…`), `CLAUDE.md` (layout, CI and Releases),
  `docs/linux-service.md` (GeoIP script name, Windows port note).
- Repo secret `RELEASE_TOKEN` (fine-grained PAT, contents and pull-requests read/write) recommended. Adding it is
  the maintainer's decision.
