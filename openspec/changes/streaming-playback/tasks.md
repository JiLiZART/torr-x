## 1. Engine and server

- [ ] 1.1 `crates/torrentx-rqbit`: expose the per-file seekable stream URL; `crates/torrentx-transmission`:
      return `Unsupported`; verify `cargo test --workspace` passes
- [ ] 1.2 Capability matrix: `streaming` key (rqbit `via: engine`, Transmission unsupported); verify the
      capabilities API test asserts both engines' entries
- [ ] 1.3 `api.rs`: `GET /torrents/{id}/files/{index}/stream` relaying Range/206/Content-Range from the engine
      behind auth + guards; 501 on unsupported engines, 404 on bad index; verify tower `oneshot` tests for
      the 501 path and header relay against a stub upstream, plus a manual seek check on a real rqbit download
- [ ] 1.4 Verify an unauthenticated request to the stream route is rejected when auth is on (same guard tests)

## 2. UI

- [ ] 2.1 `packages/api-client`: `streamUrl(id, index)` builder and the `streaming` capability type; verify
      `pnpm typecheck`
- [ ] 2.2 Play button on the detail hero progress bar (largest video file) and media-mode episode rows:
      enabled per the head heuristic, disabled with "not supported by Transmission" where applicable, absent
      for non-video files; verify against both engines
- [ ] 2.3 `Player` overlay: `<video controls autoplay>` on the stream URL, Escape closes, native decode errors
      shown with the copy-URL fallback; verify manually: start an episode at ~40% downloaded, play and seek
      forward within the downloaded range
- [ ] 2.4 "Copy stream URL" action with the auth caveat when auth is on; verify the clipboard holds the
      server-origin URL and never embeds credentials
- [ ] 2.5 i18n keys in all six dictionaries; verify `pnpm lint`, `pnpm typecheck`, `pnpm test` pass

## 3. Docs

- [ ] 3.1 Update `CLAUDE.md` (streaming capability, proxy endpoint) and the engine-capabilities notes; verify
      text matches behavior
