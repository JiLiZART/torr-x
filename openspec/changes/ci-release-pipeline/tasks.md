## 1. CI pipeline

- [x] 1.1 Add `.github/workflows/ci.yml` (`pull_request` + `push: main`, concurrency per ref): `js` job (pnpm install --frozen-lockfile, `pnpm lint`, `pnpm typecheck`, `pnpm test`) and `rust` job (ubuntu-22.04, Tauri Linux deps, `pnpm build:web`, `cargo test --workspace`, rust-cache); verify with `actionlint` locally and a green run on a test PR
- [ ] 1.2 Verify a deliberately failing lint on a throwaway branch makes the `js` job fail, then delete the branch

## 2. Knope changesets

- [x] 2.1 Add `knope.toml` (versioned files: root `Cargo.toml`, `Cargo.lock` × 5 workspace crates, 5 `package.json`, `tauri.conf.json`; `changelog = "CHANGELOG.md"`; `[bot.releases] enabled = true`); verify with `knope --validate` (or `npx knope --validate`) locally
- [x] 2.2 Add `.changeset/first-public-release.md` (`default: minor`) describing the first release with binaries; verify `knope release --dry-run` (with a local `v0.1.0` tag) shows 0.1.1, every versioned file bumped and only this entry in the changelog
- [x] 2.3 Push the baseline tag `v0.1.0` on the current `main` commit so release notes start after it; verify `git ls-remote --tags origin v0.1.0`
- [ ] 2.4 (Repo admin, manual) Install the Knope Bot GitHub App on `JiLiZART/torr-x`; verify the "Require changes to be documented" check appears on the PR from 2.1/2.2 and a `knope/release` PR opens after merge

## 3. Build and release workflows

- [x] 3.1 Add reusable `.github/workflows/build.yml` (`workflow_call`, input `label`): server matrix (ubuntu-22.04, ubuntu-22.04-arm) producing `torrentx-server-<label>-linux-<arch>.tar.gz` with binary + `torrentx.service` + `linux-service.md`; desktop matrix (macOS universal dmg, Windows msi + setup exe, Linux AppImage + deb) renamed to `<label>`; all via `pnpm build:server` / `pnpm build:desktop`; upload as artifacts; verify with `actionlint`
- [ ] 3.2 Add `.github/workflows/nightly.yml` (`push: main`, `paths-ignore` docs/openspec, concurrency `nightly` cancel-in-progress): call build with `label: nightly`, publish job writes `SHA256SUMS.txt`, recreates pre-release `nightly` (`--prerelease --latest=false`, notes with commit SHA) at `github.sha`; verify after merge: `nightly` pre-release has 7 assets + checksums and "Latest" is unaffected
- [x] 3.3 Add `.github/workflows/release.yml` (`pull_request: closed` on main, `if merged && head_ref == 'knope/release'`, plus `workflow_dispatch` input `tag`): read version from `Cargo.toml`, call build with that label, wait for the bot's `v<version>` release, `gh release upload --clobber` assets + `SHA256SUMS.txt`; verify with `actionlint`
- [ ] 3.4 Verify end to end by merging the first release PR: tag `v0.1.1`, release notes = changelog entry, all assets present, `sha256sum -c SHA256SUMS.txt` passes, Linux server tarball starts and serves the UI, macOS dmg opens (right-click → Open), re-running the workflow via `workflow_dispatch` does not duplicate assets

## 4. Repo settings and docs

- [ ] 4.1 (Repo admin, manual) Branch protection on `main`: require `ci` jobs and the Knope documentation check; allow Actions read/write; verify a PR without a change file is blocked
- [x] 4.2 Update `CLAUDE.md` (remove "No CI pipeline" gap; add a Releases section: change files, release PR, nightly) and `README.md` (download links, unsigned-app note, how to add a change file); verify links and commands match the workflows
