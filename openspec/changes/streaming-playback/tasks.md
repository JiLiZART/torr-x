## 1. Engine and server (shipped in f905b64)

- [x] 1.1 `crates/torrentx-rqbit`: `stream(id, index)` returns the file length and librqbit's `FileStream`;
      Transmission returns `unsupported`
- [x] 1.2 Capability key `stream` (rqbit `via: engine`, Transmission unsupported)
- [x] 1.3 `POST /torrents/{id}/files/{index}/stream` issues a token link; public `GET /stream/{token}/{name}` serves
      ranges (206, `Content-Range`, 416); `POST …/play` (loopback) opens the file or the link in the player;
      tower `oneshot` tests and a manual range check on a real rqbit download
- [x] 1.4 Stream and play routes are in the auth and CSRF guard tests; the public route needs a live token

## 2. UI

- [x] 2.1 `packages/api-client`: `streamFile(id, index)` and `playFile(id, index)`; `stream` capability key
- [x] 2.2 `lib/media.ts` `headNeed` + `INLINE_EXT`, `fileActionBlock` `notReady`; unit tests
- [x] 2.3 `usePlayback` shared by the hero Play button (largest video file), the featured episode and the file
      actions: disabled with the engine hint or with how much more is needed, absent for non-video files
- [x] 2.4 `Player` overlay: `<video controls autoplay>` on the stream link, Escape closes, decode errors shown with
      "Copy stream link" and (local) "Open in video player"; link caveat in the footer
- [x] 2.5 i18n keys in all six dictionaries; `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
- [ ] 2.6 Verify in a browser: an mp4 at ~40% plays in the overlay and seeks within the downloaded range; an
      MKV opens the external player; a file below the head shows how much is needed

## 3. Docs

- [x] 3.1 Update `CLAUDE.md` (built-in player, start check)
