## Purpose

Defines how TorrentX changes are checked, documented and released: CI on every pull request, one change file per
user-facing change, a release pull request that turns accumulated change files into a versioned GitHub release with
changelog and binaries, and a rolling nightly pre-release built from `main`.

## ADDED Requirements

### Requirement: Continuous integration checks
Every pull request to `main` and every push to `main` SHALL run the JS lint, typecheck and unit tests and the Rust workspace tests, and SHALL report a failing status when any of them fails.

#### Scenario: Lint error in a PR
- **WHEN** a pull request introduces an ESLint warning or error
- **THEN** the CI check on that pull request fails and names the lint step

#### Scenario: Green PR
- **WHEN** a pull request passes lint, typecheck, JS tests and `cargo test --workspace`
- **THEN** the CI check succeeds

### Requirement: Documented changes
Every pull request to `main` SHALL be documented either by at least one change file in `.changeset/` declaring the release type (major, minor or patch) and a user-facing description, or only by conventional commits; a pull request with neither SHALL fail the change-documentation check. One user-facing feature or fix SHALL be described by one change file.

#### Scenario: Feature PR without change file
- **WHEN** a pull request with a non-conventional commit message and no change file is opened
- **THEN** the documentation check fails and tells the author how to add a change file

#### Scenario: Tooling-only PR
- **WHEN** a pull request contains only `ci:` or `docs:` conventional commits
- **THEN** the documentation check passes and the change is not listed in the next release notes

### Requirement: Release pull request
While `main` has unreleased change files or releasing conventional commits, an open release pull request SHALL show the next version and its release notes, and SHALL be updated whenever `main` changes. The next version SHALL follow semantic versioning from the highest declared change type; while the major version is 0, a major change SHALL bump the minor version and a minor change SHALL bump the patch version. Release notes SHALL only cover changes since the previous version tag. The release pull request SHALL update the version in every versioned project file to the same value and prepend the release notes to `CHANGELOG.md`, and SHALL remove the consumed change files.

#### Scenario: Two features and a fix merged
- **WHEN** two minor and one patch change file are merged into `main` at version 1.2.0
- **THEN** the release pull request proposes 1.3.0 with all three entries in its notes

#### Scenario: Pre-1.0 feature
- **WHEN** one minor change file is merged into `main` at version 0.1.0
- **THEN** the release pull request proposes 0.1.1

#### Scenario: Versions stay in sync
- **WHEN** the release pull request proposes version X.Y.Z
- **THEN** the Cargo workspace version, `Cargo.lock` entries of workspace crates, every workspace `package.json` and the Tauri config all read X.Y.Z in that pull request

### Requirement: Versioned release
Merging the release pull request SHALL create the Git tag `vX.Y.Z` and a GitHub release named for that version whose notes are the version's changelog entry, and SHALL attach these binaries built from the tagged commit: the headless server for Linux x86_64 and aarch64 as tarballs containing the binary, the systemd unit and the service install guide; the desktop app as a macOS universal disk image, Windows x64 MSI and setup executable, and Linux x64 AppImage and Debian package; and a SHA-256 checksum file covering every attached binary. All binaries SHALL embed the web UI and the GeoIP database. If a binary build fails, the release SHALL remain without that binary and the workflow SHALL fail visibly; re-running it SHALL fill in missing binaries without duplicating existing ones.

#### Scenario: Merge release PR
- **WHEN** a maintainer merges the release pull request proposing 0.1.1
- **THEN** tag `v0.1.1` exists, the release "0.1.1" shows the changelog, and its assets include both server tarballs, the five desktop installers and `SHA256SUMS.txt`

#### Scenario: Install server from release
- **WHEN** an admin downloads the Linux aarch64 server tarball and follows the bundled guide
- **THEN** `torrentx-server` starts and serves the web UI with peer country lookup available

#### Scenario: Checksums
- **WHEN** a user runs `sha256sum -c SHA256SUMS.txt` next to the downloaded assets
- **THEN** every listed file verifies OK

### Requirement: Rolling nightly pre-release
Every push to `main` SHALL rebuild the same set of binaries and replace the contents of a single GitHub pre-release with tag `nightly`, moved to that commit. The nightly release SHALL be marked as a pre-release so it is never shown as the latest release, its notes SHALL state the commit it was built from, and its asset names SHALL contain `nightly` instead of a version number. A newer push SHALL supersede an in-progress nightly build.

#### Scenario: Merge a feature
- **WHEN** a feature pull request is merged into `main`
- **THEN** after the build the `nightly` pre-release points at the merge commit and offers freshly built binaries named with `nightly`

#### Scenario: Latest stays stable
- **WHEN** both `v0.1.1` and a newer `nightly` exist
- **THEN** the repository's "Latest" release is `v0.1.1`
