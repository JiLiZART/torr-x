## Context

- Remote: `github.com/JiLiZART/torr-x`. No `.github/`, no tags, no `CHANGELOG.md`. Everything is at `0.1.0`:
  `[workspace.package] version` in root `Cargo.toml` (all crates use `version.workspace = true`), five
  `package.json` files (root, `apps/web`, `apps/desktop`, `packages/ui`, `packages/api-client`) and
  `apps/desktop/src-tauri/tauri.conf.json`.
- Release builds already have scripts: `pnpm build:server` / `pnpm build:desktop` = `build:web` +
  `scripts/fetch-geoip.sh` + cargo/tauri build with `--features geoip`. The UI must be built before cargo
  (rust-embed). Tauri `bundle.targets = "all"`.
- The Knope Bot GitHub App can't be installed on this repo, so the same flow runs with the Knope CLI (0.23.0) in
  GitHub Actions, following Knope's "Preview releases with pull requests" recipe. The repo is public; Actions'
  default token is read-only and "Allow GitHub Actions to create pull requests" is off.

## Goals / Non-Goals

**Goals:** one build definition for nightly and versioned releases; reproducible asset names; minimal hand-written
release logic (Knope owns versions, changelog, tag, release notes).

**Non-Goals:** code signing/notarization (hooks left), Tauri auto-updater, crates.io/npm publishing, Docker images,
Linux arm64 desktop builds, macOS/Windows server binaries, release-time e2e tests.

## Decisions

1. **Knope CLI in Actions instead of Knope Bot** (bot can't be installed). `knope.toml` declares the package
   (`versioned_files`: root `Cargo.toml`, `Cargo.lock` × 5 workspace crates, 5 `package.json`, `tauri.conf.json`;
   `changelog = "CHANGELOG.md"`; `assets = "artifacts/*"`), `[github] owner/repo`, and three workflows:
   `document-change` (CreateChangeFile, for contributors), `prepare-release` (switch to `release`, PrepareRelease,
   commit `chore: prepare release $version`, force-push, CreatePullRequest to `main` with `$changelog` as body) and
   `release` (Release). Change files: `.changeset/*.md` with `default: minor|patch|major` front matter.
   *Alt:* Knope Bot — preferred originally, unavailable. *Alt:* `@changesets/cli` — JS-only versioning, would not bump
   `Cargo.toml`/`tauri.conf.json`.
2. **Workflows**
   - `ci.yml` — `pull_request` + `push: main`. Jobs: `changes` (PRs only; replaces the bot's check: `knope --validate`,
     then pass if the PR adds a `.changeset/*.md`, every commit subject is a conventional commit, or the head is
     `release`), `js` (pnpm install --frozen-lockfile, lint, typecheck, test) and
     `rust` (ubuntu-22.04 + Tauri Linux deps, `pnpm build:web` so rust-embed has the real UI, `cargo test --workspace`).
     `concurrency: ci-${{ github.ref }}`, cancel in progress.
   - `build.yml` — `workflow_call` with input `label` (version like `0.2.0`, or `nightly`). Matrix:
     | job | runner | output |
     |---|---|---|
     | server x86_64 | `ubuntu-22.04` | `torrentx-server-<label>-linux-x86_64.tar.gz` |
     | server aarch64 | `ubuntu-22.04-arm` | `torrentx-server-<label>-linux-aarch64.tar.gz` |
     | desktop macOS | `macos-latest`, `--target universal-apple-darwin` | `TorrentX_<label>_universal.dmg` |
     | desktop Windows | `windows-latest` | `TorrentX_<label>_x64_en-US.msi`, `TorrentX_<label>_x64-setup.exe` |
     | desktop Linux | `ubuntu-22.04` | `TorrentX_<label>_amd64.AppImage`, `TorrentX_<label>_amd64.deb` |
     Each job: checkout, pnpm + node (cache), Rust (+ `Swatinem/rust-cache`), Linux deps where needed
     (`libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf`), then the existing
     `pnpm build:server` / `pnpm build:desktop` scripts. Assets are renamed to replace Tauri's `<version>` with
     `<label>` (a no-op for releases) and uploaded with `actions/upload-artifact`. Server tarball contents:
     `torrentx-server`, `torrentx.service`, `linux-service.md`. ubuntu-22.04 keeps the glibc floor at 2.35.
   - `nightly.yml` — `push: main`, `concurrency: nightly` with cancel-in-progress. Calls `build.yml` with
     `label: nightly`, then `publish`: downloads artifacts, writes `SHA256SUMS.txt`, `gh release delete nightly
     --cleanup-tag -y || true`, `git push -f` tag `nightly` to `github.sha`, `gh release create nightly --prerelease
     --latest=false --title "Nightly" --notes "Built from <sha>…"` with all assets. Delete+create (not edit) so stale
     assets never linger.
   - `prepare-release.yml` — `push: main` (skipped when the head commit is `chore: prepare release`), concurrency
     with cancel. A shell gate checks for `.changeset/*.md` or releasing commits (`feat`/`fix`/`!`) since the last
     `v*` tag (a Knope dry run with nothing to release fails with a misleading error, so it can't be the gate), then
     runs `knope prepare-release`. Token: `secrets.RELEASE_TOKEN || github.token`.
   - `release.yml` — `pull_request: closed` on `main` with `if: merged && head_ref == 'release'` (same-repo only),
     plus `workflow_dispatch` with input `tag` for re-runs. `version` job reads `workspace.package.version` from the
     merge commit's `Cargo.toml`. Calls `build.yml` with `label: <version>`. `publish` downloads into `artifacts/`,
     adds `SHA256SUMS.txt`, then `knope release` (draft → upload assets → publish, notes from the changelog section,
     tag `v<version>`). If the release already exists (re-run), `gh release upload --clobber` instead.
   - Permissions: `contents: read` by default; `contents: write` only on the publish jobs.
3. **Build before release.** The release is created only after all binaries built, so the page never appears
   without assets; a failed build leaves no release and the PR merge can be retried via `workflow_dispatch` only once
   a tag exists — otherwise re-run the failed workflow run.
4. **Nightly keeps the base version inside binaries** (e.g. health reports `0.2.0`) and only file names say
   `nightly`. Injecting `0.2.0-nightly.N` would break MSI (WiX needs numeric versions). Release notes carry the SHA.
5. **Unsigned builds**: macOS users must right-click → Open (or `xattr -d com.apple.quarantine`); documented in the
   release notes footer via README. Signing later = secrets + `APPLE_*`/`TAURI_SIGNING_*` env in `build.yml` only.
6. **Bootstrap**: tag the current `main` commit `v0.1.0` before the first release. Without a tag Knope reads the
   whole history and lists every old `feat:` commit in the first changelog. The PR adding `knope.toml` uses `ci:`
   commits plus one change file (`minor`: "First public release with downloadable binaries"). Knope follows
   pre-1.0 semver (minor → patch bump), so the first release PR proposes 0.1.1 (verified with
   `knope release --dry-run`).

## Risks / Trade-offs

- [Release PR is opened with `GITHUB_TOKEN`, so CI doesn't run on it and required checks would block it] → Add a
  fine-grained PAT (contents + pull requests: write) as `RELEASE_TOKEN`, or merge with admin bypass; the PR only
  bumps versions and the changelog.
- [Actions can't open PRs by default] → Enable "Allow GitHub Actions to create and approve pull requests"
  (repo settings → Actions) once.
- [`ubuntu-22.04-arm` runners free only for public repos] → If the repo is private, swap that matrix entry to
  `cross build --target aarch64-unknown-linux-gnu` (server only, no GUI deps).
- [Nightly on every push burns runner minutes (5 builds, macOS universal is slowest)] → cancel-in-progress; add
  `paths-ignore: ["openspec/**", "**/*.md"]`.
- [GeoIP download from db-ip.com per job can fail/ratelimit] → Script already falls back to last month; failure fails
  only that job; rerun.
- [`cargo test` server test that starts a real rqbit engine] → Fine on clean runners; mark `#[ignore]` only if it
  flakes in CI.

## Migration Plan

1. Merge `ci.yml` first (PR with `ci:` commits) and make it a required check.
2. Enable Actions PR creation (and optionally add `RELEASE_TOKEN`), merge `knope.toml` + workflows + first change file.
3. Verify a nightly appears, then merge the first release PR → `v0.1.1` with binaries.
Rollback: delete the workflows; tags and releases can stay.
