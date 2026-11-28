## MODIFIED Requirements

### Requirement: Versioned release
Merging the release pull request SHALL create the Git tag `vX.Y.Z` and a GitHub release named for that version whose notes are the version's changelog entry. The release SHALL attach these binaries built from the tagged commit:
- the headless server for Linux x86_64 and aarch64, as tarballs containing the binary, the systemd unit and the service install guide;
- the desktop app as a macOS universal disk image, a Windows x64 MSI and setup executable, and a Linux x64 AppImage and Debian package;
- a SHA-256 checksum file covering every attached binary.

All binaries SHALL embed the web UI and the GeoIP database. Each binary SHALL also be attached under a stable name without the version (`TorrentX-macos-universal.dmg`, `TorrentX-windows-x64.msi`, `TorrentX-windows-x64-setup.exe`, `TorrentX-linux-x86_64.AppImage`, `TorrentX-linux-amd64.deb`, `torrentx-server-linux-x86_64.tar.gz`, `torrentx-server-linux-aarch64.tar.gz`), so `releases/latest/download/<name>` always serves the newest version. If a binary build fails, the release SHALL remain without that binary and the workflow SHALL fail visibly. Re-running it for the tag SHALL fill in missing binaries without duplicating existing ones. Pushing a `vX.Y.Z` tag by hand SHALL build and publish the same set.

#### Scenario: Merge release PR
- **WHEN** a maintainer merges the release pull request proposing 0.1.1
- **THEN** tag `v0.1.1` exists, the release "0.1.1" shows the changelog, and its assets include both server tarballs, the five desktop installers, their stable-named copies and `SHA256SUMS.txt`

#### Scenario: Install server from release
- **WHEN** an admin downloads the Linux aarch64 server tarball and follows the bundled guide
- **THEN** `torrentx-server` starts and serves the web UI with peer country lookup available

#### Scenario: Checksums
- **WHEN** a user runs `sha256sum -c SHA256SUMS.txt` next to the downloaded assets
- **THEN** every listed file verifies OK

#### Scenario: Stable download link
- **WHEN** a user opens `https://github.com/torrentx/torrentx/releases/latest/download/TorrentX-windows-x64.msi`
- **THEN** the MSI of the newest versioned release downloads

## REMOVED Requirements

### Requirement: Rolling nightly pre-release
**Reason**: Replaced by the rolling `tip` pre-release built by the single release workflow, following 2fau-app.
**Migration**: Links to `releases/tag/nightly` move to `releases/tag/tip`. The `nightly` release and tag are deleted once the first `tip` exists.

## ADDED Requirements

### Requirement: Rolling tip pre-release
Every push to `main` that does not publish a version SHALL rebuild the desktop installers and server tarballs and replace a single GitHub pre-release with tag `tip`, moved to that commit. The `tip` release SHALL be marked as a pre-release so it is never shown as the latest release, and its notes SHALL state the commit it was built from. A newer push SHALL supersede an in-progress `tip` build.

#### Scenario: Merge a feature
- **WHEN** a feature pull request is merged into `main`
- **THEN** after the build, the `tip` pre-release points at the merge commit and offers freshly built binaries

#### Scenario: Latest stays stable
- **WHEN** both `v0.1.1` and a newer `tip` exist
- **THEN** the repository's "Latest" release is `v0.1.1`

### Requirement: Release pull request runs CI
When the repository provides a release token, the release pull request SHALL be opened with it, so the CI checks run on that pull request like on any other. Without the token, the release pull request SHALL still be opened and updated, and merging it SHALL still publish the release with all binaries; only its CI checks wait for manual approval.

#### Scenario: Token configured
- **WHEN** `RELEASE_TOKEN` is set and `main` gains a change file
- **THEN** the release pull request is updated and its CI checks run without manual approval

#### Scenario: No token
- **WHEN** `RELEASE_TOKEN` is not set and the release pull request is merged
- **THEN** the release and tag are created and all binaries are attached by the same workflow run
