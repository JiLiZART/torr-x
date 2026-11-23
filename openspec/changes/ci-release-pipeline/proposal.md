## Why

The project has no CI and no release process (CLAUDE.md "Known Gaps: No CI pipeline"): nothing checks PRs, versions
are hand-edited `0.1.0` in a dozen files, and users have no downloadable builds of the server or desktop app.

## What Changes

- **CI pipeline** (GitHub Actions): every PR and push to `main` runs `pnpm lint`, `pnpm typecheck`, `pnpm test` and
  `cargo test --workspace`.
- **Changeset workflow via the Knope CLI in GitHub Actions** (same flow as the [bot workflow](https://knope.tech/tutorials/bot-workflow/), which can't be installed here): each feature PR
  carries one change file in `.changeset/` (or only non-releasing conventional commits like `ci:`/`docs:`); a CI
  `changes` check enforces it (`knope document-change` creates the file). PRs merge to `main` and their change files pile up.
- **Release PR**: on every push to `main`, a workflow runs `knope prepare-release` and keeps a `release` PR open with
  the next version (semver from the change files) and the generated changelog. Merging it bumps every versioned
  file and updates `CHANGELOG.md`; the release workflow then builds the binaries and `knope release` creates the
  `vX.Y.Z` tag and a GitHub release whose notes are the changelog.
- **Release binaries** attached to that release:
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

- New: `.github/workflows/{ci,build,nightly,prepare-release,release}.yml`, `knope.toml`, `.changeset/` (with a first change file),
  `CHANGELOG.md` (created by Knope on first release).
- Versioned by Knope: root `Cargo.toml` (`workspace.package.version`), `Cargo.lock` (workspace crates), all
  workspace `package.json` files, `apps/desktop/src-tauri/tauri.conf.json`.
- Manual, one-time (repo admin): enable "Allow GitHub Actions to create and approve pull requests"; optionally add a
  `RELEASE_TOKEN` PAT so CI runs on the release PR; make the CI checks required on `main`.
- Docs: `CLAUDE.md` (Known Gaps, Commands), `README.md` contributing/release section.
- No code or API changes. No new runtime dependencies.
