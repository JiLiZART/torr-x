## Why

The project has no CI and no release process (CLAUDE.md "Known Gaps: No CI pipeline"): nothing checks PRs, versions
are hand-edited `0.1.0` in a dozen files, and users have no downloadable builds of the server or desktop app.

## What Changes

- **CI pipeline** (GitHub Actions): every PR and push to `main` runs `pnpm lint`, `pnpm typecheck`, `pnpm test` and
  `cargo test --workspace`.
- **Changeset workflow via Knope Bot** ([bot workflow](https://knope.tech/tutorials/bot-workflow/)): each feature PR
  carries one change file in `.changeset/` (or only non-releasing conventional commits like `ci:`/`docs:`); the bot's
  "Require changes to be documented" check enforces it. PRs merge to `main` and their change files pile up.
- **Release PR**: Knope Bot keeps a `knope/release` PR open with the next version (semver from the change files) and
  the generated changelog. Merging it bumps every versioned file, updates `CHANGELOG.md`, creates the `vX.Y.Z` tag
  and a GitHub release whose notes are the changelog.
- **Release binaries**: merging the release PR also builds and attaches to that release:
  - `torrentx-server` for Linux x86_64 and aarch64 (tarball with the binary, systemd unit and service guide),
  - desktop installers: macOS universal `.dmg`, Windows x64 `.msi` + setup `.exe`, Linux x64 `.AppImage` + `.deb`,
  - `SHA256SUMS.txt`.
  All built with the embedded web UI and GeoIP database. Unsigned (no Apple/Windows code signing yet).
- **Rolling nightly**: every push to `main` rebuilds the same set of binaries and replaces one GitHub pre-release
  tagged `nightly` (pointing at that commit), so "Latest release" stays the last versioned release.
- One shared build workflow used by both nightly and versioned releases.

## Capabilities

### New Capabilities
- `release-process`: CI checks on PRs, change-file enforcement, release PR, versioned releases with changelog and
  binaries, rolling nightly pre-release.

### Modified Capabilities
<!-- none: no runtime behavior of the server, UI or desktop app changes -->

## Impact

- New: `.github/workflows/{ci,build,nightly,release}.yml`, `knope.toml`, `.changeset/` (with a first change file),
  `CHANGELOG.md` (created by Knope on first release).
- Versioned by Knope: root `Cargo.toml` (`workspace.package.version`), `Cargo.lock` (workspace crates), all
  workspace `package.json` files, `apps/desktop/src-tauri/tauri.conf.json`.
- Manual, one-time (repo admin): install the Knope Bot GitHub App on `JiLiZART/torr-x`, make the CI and Knope checks
  required on `main`, allow Actions to create releases (`contents: write`).
- Docs: `CLAUDE.md` (Known Gaps, Commands), `README.md` contributing/release section.
- No code or API changes. No new runtime dependencies.
