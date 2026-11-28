## 1. Prerequisite

- [x] 1.1 Archive `ci-release-pipeline` (sync its `release-process` spec into `openspec/specs/`), noting that its open manual tasks are superseded here; verify `openspec validate cross-platform-builds --strict` and that `openspec/specs/release-process/spec.md` exists

## 2. Cross-platform scripts

- [x] 2.1 Add `cross-env` to root devDependencies and use it in `dev:desktop`; verify `pnpm dev:desktop` still starts on macOS, and `pnpm install --frozen-lockfile` passes after updating the lockfile
- [x] 2.2 Add `scripts/fetch-geoip.mjs` (Node `fetch` + `zlib`, this month then last month, temp file + rename, exit 1 on failure) and a root `fetch:geoip` script; delete `scripts/fetch-geoip.sh`; verify `pnpm fetch:geoip` writes `crates/torrentx-server/geoip/dbip-country-lite.mmdb` and a broken URL exits 1
- [x] 2.3 Rewrite `build:server` / `build:desktop` on `fetch:geoip`; add `build:desktop:macos` (`--target universal-apple-darwin`), `build:desktop:windows` (`--bundles msi,nsis`), `build:desktop:linux` (`--bundles appimage,deb`); verify `pnpm build:desktop:macos` produces a universal dmg locally and `pnpm lint` passes

## 3. Windows port detection

- [x] 3.1 `probe()`: every transport error → `Nothing`; only a non-TorrentX HTTP answer → `Foreign`; verify `cargo test --workspace` and `cargo clippy -p torrentx-desktop`
- [x] 3.2 Add `StartError::Forbidden(addr)` for `ErrorKind::PermissionDenied` on bind, with a server test that binds a forbidden address where possible; map it in `connect()` to a dialog naming the port, the `netsh interface ipv4 show excludedportrange protocol=tcp` check and the config path; verify `cargo test --workspace`
- [ ] 3.3 Manual check on Windows: `pnpm dev:desktop` with nothing on 9977 opens the window (no "used by another program"); with a foreign HTTP server on 9977 shows the taken-port dialog; with 9977 inside an excluded range (`netsh int ipv4 add excludedportrange protocol=tcp startport=9977 numberofports=1`, removed afterwards) shows the reserved-port dialog

## 4. Release workflow

- [x] 4.1 Rewrite `.github/workflows/release.yml` per design decision 5 (`target`, read-only `desktop` / `server` builds via the package scripts uploading artifacts, `publish` as the only write job: Knope release or `nightly`, stable names, `SHA256SUMS.txt`); delete `build.yml` and `nightly.yml`; drop `assets` from `knope.toml`; verify with `actionlint` and `knope --validate`
- [ ] 4.2 Switch `ci.yml` to the new scripts where it builds (`pnpm fetch:geoip` not needed for tests; keep `pnpm build:web`); verify `actionlint` and a green CI run on the PR
- [ ] 4.3 Verify on `main` after merge: a push replaces the `nightly` pre-release at that commit with five installers and two server tarballs named `nightly`, plus `SHA256SUMS.txt`, and "Latest" is unchanged; delete the interim `tip` release (`gh release delete tip --cleanup-tag`)
- [ ] 4.4 Verify the versioned path by merging the release PR: tag `vX.Y.Z`, changelog notes, versioned and stable-named assets, `sha256sum -c SHA256SUMS.txt` passes, `releases/latest/download/TorrentX-windows-x64.msi` downloads; re-running via `workflow_dispatch` with the tag does not duplicate assets

## 5. Docs

- [x] 5.1 Update `README.md` (download links to `releases/latest/download/<name>`, Windows dev note), `CLAUDE.md` (layout: `fetch-geoip.mjs`; Commands: per-platform builds; CI and Releases: single `release.yml`, `nightly`, `RELEASE_TOKEN`) and `docs/linux-service.md` (GeoIP script); add `.changeset/cross-platform-builds.md` (`default: patch`, Windows dev/port fix); verify links and commands match the workflows and `pnpm lint` passes
