## Context

- Remote: `github.com/JiLiZART/torr-x`. No `.github/`, no tags, no `CHANGELOG.md`. Everything is at `0.1.0`:
  `[workspace.package] version` in root `Cargo.toml` (all crates use `version.workspace = true`), five
  `package.json` files (root, `apps/web`, `apps/desktop`, `packages/ui`, `packages/api-client`) and
  `apps/desktop/src-tauri/tauri.conf.json`.
- Release builds already have scripts: `pnpm build:server` / `pnpm build:desktop` = `build:web` +
  `scripts/fetch-geoip.sh` + cargo/tauri build with `--features geoip`. The UI must be built before cargo
  (rust-embed). Tauri `bundle.targets = "all"`.
- Knope Bot (GitHub App) does the changeset part without any workflow: PR check, `knope/release` PR, and on merge the
  tag + GitHub release. It only needs `knope.toml`. Binaries are the repo's job: the tutorial triggers a workflow on
  `pull_request: closed` for head ref `knope/release`.

## Goals / Non-Goals

**Goals:** one build definition for nightly and versioned releases; reproducible asset names; minimal hand-written
release logic (Knope owns versions, changelog, tag, release notes).

**Non-Goals:** code signing/notarization (hooks left), Tauri auto-updater, crates.io/npm publishing, Docker images,
Linux arm64 desktop builds, macOS/Windows server binaries, release-time e2e tests.

## Decisions

1. **Knope Bot, not the Knope CLI in Actions.** Follows the requested tutorial; no token/PR-creation plumbing in
   workflows. `knope.toml`:
   ```toml
   [package]
   versioned_files = [
     "Cargo.toml",
     { path = "Cargo.lock", dependency = "torrentx-core" },   # one entry per workspace crate (5)
     "package.json", "apps/web/package.json", "apps/desktop/package.json",
     "packages/ui/package.json", "packages/api-client/package.json",
     "apps/desktop/src-tauri/tauri.conf.json",
   ]
   changelog = "CHANGELOG.md"

   [bot.releases]
   enabled = true
   ```
   Change files live in `.changeset/*.md` (Knope's format: front matter `default: minor|patch|major`, then a heading
   and body). The bot's "Add change file" buttons create them; locally `knope document-change` works too (optional).
   *Alt:* Knope CLI + `prepare-release` workflow — gives build-before-release ordering but re-implements what the bot
   does and needs a PAT so the release PR triggers CI. *Alt:* `@changesets/cli` — JS-only versioning, would not bump
   `Cargo.toml`/`tauri.conf.json`.
2. **Workflows**
   - `ci.yml` — `pull_request` + `push: main`. Jobs: `js` (pnpm install --frozen-lockfile, lint, typecheck, test) and
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
   - `release.yml` — `pull_request: closed` on `main` with `if: merged && head_ref == 'knope/release'`, plus
     `workflow_dispatch` with input `tag` for re-runs. `version` job reads `workspace.package.version` from the merge
     commit's `Cargo.toml` → tag `v<version>`. Calls `build.yml` with `label: <version>`. `publish` waits (poll
     `gh release view v<version>`, up to 10 min) for the bot's release, then `gh release upload --clobber` assets +
     `SHA256SUMS.txt` (clobber makes re-runs idempotent).
   - Permissions: `contents: read` by default; `contents: write` only on the publish jobs.
3. **Trigger on PR merge, not `on: release`.** Per the tutorial, the release event misses bot-created/draft cases;
   the `knope/release` head ref is stable. Building from the merge commit equals building the tagged commit because
   the bot tags that commit.
4. **Nightly keeps the base version inside binaries** (e.g. health reports `0.2.0`) and only file names say
   `nightly`. Injecting `0.2.0-nightly.N` would break MSI (WiX needs numeric versions). Release notes carry the SHA.
5. **Unsigned builds**: macOS users must right-click → Open (or `xattr -d com.apple.quarantine`); documented in the
   release notes footer via README. Signing later = secrets + `APPLE_*`/`TAURI_SIGNING_*` env in `build.yml` only.
6. **Bootstrap**: tag the current `main` commit `v0.1.0` before enabling the bot. Without a tag Knope reads the
   whole history and lists every old `feat:` commit in the first changelog. The PR adding `knope.toml` uses `ci:`
   commits plus one change file (`minor`: "First public release with downloadable binaries"). Knope follows
   pre-1.0 semver (minor → patch bump), so the first release PR proposes 0.1.1 (verified with
   `knope release --dry-run`).

## Risks / Trade-offs

- [Release page exists ~20–40 min before its binaries] → Notes are complete immediately; publish job fails loudly;
  `workflow_dispatch` re-run fills gaps.
- [`ubuntu-22.04-arm` runners free only for public repos] → If the repo is private, swap that matrix entry to
  `cross build --target aarch64-unknown-linux-gnu` (server only, no GUI deps).
- [Nightly on every push burns runner minutes (5 builds, macOS universal is slowest)] → cancel-in-progress; add
  `paths-ignore: ["openspec/**", "**/*.md"]`.
- [GeoIP download from db-ip.com per job can fail/ratelimit] → Script already falls back to last month; failure fails
  only that job; rerun.
- [Release PR merges don't trigger CI on the bot's own commits?] → Knope Bot is a GitHub App, so its pushes do
  trigger workflows (unlike `GITHUB_TOKEN` pushes). Verify on the first release PR.
- [`cargo test` server test that starts a real rqbit engine] → Fine on clean runners; mark `#[ignore]` only if it
  flakes in CI.

## Migration Plan

1. Merge `ci.yml` first (PR with `ci:` commits) and make it a required check.
2. Install Knope Bot on the repo, merge `knope.toml` + build/nightly/release workflows + first change file.
3. Verify a nightly appears, then merge the first release PR → `v0.1.1` with binaries.
Rollback: delete workflows / uninstall the bot; tags and releases can stay.
