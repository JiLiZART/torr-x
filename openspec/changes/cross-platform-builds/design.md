## Context

- `dev:desktop` is `TORRENTX_UI_DEV_URL=http://localhost:1420 pnpm --filter @torrentx/desktop tauri dev`. pnpm runs
  scripts through `cmd` on Windows, which does not accept the inline assignment.
- `build:server` / `build:desktop` call `./scripts/fetch-geoip.sh`, which needs `sh`, `curl`, `gunzip` and the
  BSD/GNU `date` flags. CI's `build.yml` repeats the steps with `bash` to get around this.
- Desktop start-up (`apps/desktop/src-tauri/src/lib.rs`): `probe()` calls `GET /api/v1/health` with an 800 ms
  timeout. Only `is_connect()` errors mean "nothing there". Any other error, a timeout included, means `Foreign`,
  and that shows "Port {port} is used by another program". On Windows a connection to a closed loopback port is not
  refused at once: the stack retries the SYN and gives up after about 2 s. The probe therefore times out on a free
  port and reports it as foreign. This is the reported bug (the user confirmed nothing listens on the port).
- A port inside a Windows excluded range (Hyper-V/WinNAT/Docker reserve random blocks) fails `bind` with
  `WSAEACCES` (10013, `PermissionDenied`). That is a separate failure, today shown as the raw `StartError::Bind` text.
- Release CI today: `build.yml` (reusable matrix) is called by `nightly.yml` (push to `main`, `nightly`
  pre-release) and `release.yml` (merged `release` PR, then `knope release`). `prepare-release.yml` keeps the Knope
  release PR, already with `RELEASE_TOKEN || github.token`. The secret is not set, so the release PR's CI waits at
  "action_required".
- Model (2fau-app `release.yml`): one workflow on push to `main`, `v*` tags and `workflow_dispatch`:
  - `knope-release` runs on `main`, and a `no_release` result is fine;
  - `reset-tip` deletes the rolling `tip` release;
  - `bundle` builds with `tauri-apps/tauri-action` (SHA-pinned) in a matrix, with `tagName` = the tag or `tip`,
    `prerelease` when it is not a tag, and `releaseDraft: false`;
  - `stabilize-downloads` runs on tags: it copies the installers to stable names and writes checksums.

## Goals / Non-Goals

**Goals:**
- Every root script works on Windows, macOS and Linux, and CI runs the same scripts.
- No false "port used by another program" on Windows. A clear message for reserved ports.
- One release workflow shaped like 2fau-app, that publishes versioned releases and the rolling `nightly`.

**Non-Goals:**
- Code signing or notarization; the Tauri updater (`latest.json`, signing keys).
- Windows ARM64, Linux ARM64 desktop builds, or macOS self-hosted runners.
- Changing Knope versioning, change files or `prepare-release.yml` logic, apart from the token.
- Changing the Vite dev port (1420) or the server's default port (9977).

## Decisions

1. **`cross-env` for env vars in scripts.** It is the smallest fix and the one the user asked for. `dev:desktop`
   becomes `cross-env TORRENTX_UI_DEV_URL=http://localhost:1420 pnpm --filter @torrentx/desktop tauri dev`. Rejected
   alternatives: a `.env` file (Tauri does not read it), and setting the URL in `tauri.conf.json` (the server URL is
   decided at run time).

2. **`scripts/fetch-geoip.mjs` replaces the shell script.** It uses Node 24's built-in `fetch` and
   `zlib.gunzipSync`, takes this month and then last month (computed with `Date` in UTC), writes to a temp file and
   renames it, and exits 1 on failure. Same output path and messages, no new dependencies. `docs/linux-service.md`
   and `CLAUDE.md` point to it.

3. **Per-platform scripts call shared steps.** `build:web` and a new `fetch:geoip` are shared:
   - `build:server` = `pnpm build:web && pnpm fetch:geoip && cargo build --release -p torrentx-server --features geoip`;
   - `build:desktop` = web, then GeoIP, then `tauri build --features geoip` for the host;
   - `build:desktop:macos` adds `--target universal-apple-darwin`;
   - `build:desktop:windows` adds `--bundles msi,nsis`;
   - `build:desktop:linux` adds `--bundles appimage,deb`.

   CI runs these scripts directly (decision 5), so the flags have one source.

4. **Probe on evidence.** `probe()` returns `Foreign` only when an HTTP response arrives and it is not TorrentX's
   health JSON. Every transport error (refused, reset, timeout) returns `Nothing`. `connect()` then tries
   `torrentx_server::start`, and `bind` is the real test:
   - `AddrInUse` means taken, with the existing dialog;
   - a new `StartError::Forbidden(addr)` (from `ErrorKind::PermissionDenied`) means reserved, with a dialog that
     names the port, the `netsh interface ipv4 show excludedportrange protocol=tcp` check and the config path.

   Alternative: raise the timeout to 3 s. Rejected, because it slows every start and is still a guess.
   Known limit: a silent listener that accepts the connection and never answers HTTP fails the bind with `AddrInUse`,
   so it is still reported correctly.

5. **One `release.yml`, 2fau shape, with build and publish split.** Triggers: `push` to `main` (same
   `paths-ignore` as the old nightly), `push` of `v*` tags, `workflow_dispatch` (input `tag`). Concurrency: a commit
   whose message contains `chore: prepare release` gets its own group (`github.sha`) so a later push never cancels
   it; otherwise `release-<ref>` with cancel-in-progress, so `nightly` builds supersede each other. Jobs:
   - `target` (read-only): `tag` = the dispatch input, the pushed tag, `v<Cargo.toml version>` when that tag does
     not exist yet (the release PR was merged), else `nightly`; `label` = version or `nightly`; `ref` = commit.
   - `desktop` (read-only, macos-latest / windows-latest / ubuntu-22.04): `pnpm build:desktop:<platform>`, collect
     the bundles, upload a workflow artifact. `server` (read-only, ubuntu-22.04 / -arm): `pnpm build:server`, tarball
     `torrentx-server-<label>-linux-<arch>.tar.gz`, artifact.
   - `publish` (the only `contents: write` job, no installs or builds; `if: always()`): download artifacts, add
     stable names on versions, write `SHA256SUMS.txt`; for `nightly` rename `_<version>_` to `_nightly_` in desktop names, delete and recreate the pre-release with the files;
     for a version create the release if missing (`knope release` when the tag does not exist, else
     `gh release create --verify-tag`) and `gh release upload --clobber`; fail when a build job failed.

   Knope uses `github.token`, so its tag does not start a tag-push run. Build jobs check out with
   `persist-credentials: false` and their token is read-only: a compromised dependency cannot touch releases. This
   drops 2fau's `tauri-action` (it needs write access to publish), and the build jobs call the package scripts, so
   bundle flags live only in `package.json`.

6. **Keep the `nightly` name** (not 2fau's `tip`): existing links keep working. Publishing is never half-empty:
   `gh release create <tag> <files>` drafts, uploads and publishes, and `knope release` does the same with
   `assets = "artifacts/*"` (the publish job downloads the builds into `artifacts/`).

## Risks / Trade-offs

- [The Knope release and `nightly` handling run in the same `main` run] → `target` is computed once, and every job reads
  that output instead of re-deriving it.
- [Third-party actions] → pinned by commit SHA with the version in a comment; build jobs hold a read-only token.
- [Universal macOS builds are slow (two Rust targets)] → this is the same cost as today, and the rust-cache key is
  per platform.
- [A reserved-port false positive in the other direction] → `PermissionDenied` on Unix (ports below 1024 without
  privileges) gets the same "system forbids this port" message, which is still accurate.
- [`release-process` only exists in the unarchived `ci-release-pipeline` change] → archive it first, as task 1.1.
  Its open tasks (manual admin checks) are superseded by this change's verification tasks.
- [Without `RELEASE_TOKEN`, the release PR's CI still needs a click] → documented, and adding the secret is the
  maintainer's decision.
