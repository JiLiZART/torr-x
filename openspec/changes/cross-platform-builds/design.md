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
- One release workflow shaped like 2fau-app, that publishes versioned releases and a rolling `tip`.

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

   In CI, tauri-action runs `tauri build` itself. The workflow runs `pnpm build:web` and `pnpm fetch:geoip` first,
   then passes the same `--features geoip` and target or bundle flags through `args`, so the flags have one source.
   The flags live in `package.json`, and a comment in the workflow points there.

4. **Probe on evidence.** `probe()` returns `Foreign` only when an HTTP response arrives and it is not TorrentX's
   health JSON. Every transport error (refused, reset, timeout) returns `Nothing`. `connect()` then tries
   `torrentx_server::start`, and `bind` is the real test:
   - `AddrInUse` means taken, with the existing dialog;
   - a new `StartError::Forbidden(addr)` (from `ErrorKind::PermissionDenied`) means reserved, with a dialog that
     names the port, the `netsh interface ipv4 show excludedportrange protocol=tcp` check and the config path.

   Alternative: raise the timeout to 3 s. Rejected, because it slows every start and is still a guess.
   Known limit: a silent listener that accepts the connection and never answers HTTP fails the bind with `AddrInUse`,
   so it is still reported correctly.

5. **One `release.yml`, 2fau shape, adapted.** Triggers: `push` to `main` (with the same `paths-ignore` as today's
   nightly), `push` of tags `v*`, and `workflow_dispatch` (input `tag`). Concurrency `release-${{ github.ref }}`,
   cancel-in-progress. Jobs:
   - `knope-release` (only on `main` pushes) runs `knope release` with `github.token` and outputs `tag` when a
     version was published, otherwise empty. The tag is created by `github.token`, so it does not start a second,
     tag-push run. The build for that version happens in this same run, so the release never needs `RELEASE_TOKEN`.
   - `target` resolves `tag` to the Knope tag, the pushed tag, the dispatch input, or `tip`, and `prerelease` to
     `tag == 'tip'`.
   - `reset-tip` (when the target is `tip`) runs `gh release delete tip --cleanup-tag --yes || true`, then creates
     an empty `tip` pre-release at `github.sha`. The notes name the commit, and `--latest=false` is set.
   - `desktop` (matrix: macos-latest with the universal target and both Rust targets, windows-latest,
     ubuntu-22.04 with the WebKit deps) runs `tauri-apps/tauri-action` pinned by SHA with `tagName` = target,
     `releaseDraft: false`, `prerelease`, `projectPath: apps/desktop` and `args` from decision 3. fail-fast is false.
   - `server` (matrix ubuntu-22.04 / ubuntu-22.04-arm) runs `pnpm build:server`, packages the tarball as today
     under the stable name `torrentx-server-linux-<arch>.tar.gz`, and runs `gh release upload <target> --clobber`.
   - `finalize` (needs `desktop` and `server`, `if: always()`) downloads the installers. On a version tag it also
     copies them to the stable names from the spec. It writes `SHA256SUMS.txt` over every binary asset and uploads
     everything with `--clobber`, so re-runs replace assets instead of duplicating them. It fails when any build
     job failed.

   `build.yml` and `nightly.yml` are deleted, and the `nightly` release and tag are deleted by hand once `tip`
   exists. The `knope.toml` `assets` key is removed: Knope now only creates the release, and the jobs attach files.

6. **The `tip` name follows 2fau.** README links move from `nightly` to `tip`.

## Risks / Trade-offs

- [The Knope release and `tip` handling run in the same `main` run] → `target` is computed once, and every job reads
  that output instead of re-deriving it.
- [tauri-action version churn] → pin it by commit SHA like 2fau, with the version in a comment.
- [Universal macOS builds are slow (two Rust targets)] → this is the same cost as today, and the rust-cache key is
  per platform.
- [A reserved-port false positive in the other direction] → `PermissionDenied` on Unix (ports below 1024 without
  privileges) gets the same "system forbids this port" message, which is still accurate.
- [`release-process` only exists in the unarchived `ci-release-pipeline` change] → archive it first, as task 1.1.
  Its open tasks (manual admin checks) are superseded by this change's verification tasks.
- [Without `RELEASE_TOKEN`, the release PR's CI still needs a click] → documented, and adding the secret is the
  maintainer's decision.
