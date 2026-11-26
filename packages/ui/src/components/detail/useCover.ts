import { useEffect, useState, type RefObject } from "react";
import { api, ApiError, type CoverLookup, type FileInfo, type Torrent, type TorrentDetails } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import { canCapture, captureFrame, captureKey, decodeFrame, mainVideo, onceQueue, torrentLookup } from "../../lib/cover";
import { mediaEpisodes } from "../../lib/media";

/** One lookup or capture at a time for the whole app; nothing is retried within a session. */
const queue = onceQueue();
/** False once the server said it has no ffmpeg. */
let serverCapture = true;

/**
 * Gets a cover for a video file (and, for the torrent's main video, the torrent): the online lookup first
 * when it is on, since a poster outranks a frame, then a frame: `<video>`, else JS demux + WebCodecs, else
 * the server's ffmpeg. Failures are silent: no cover is a normal state.
 */
export function ensureCover(d: TorrentDetails, file: FileInfo | null, lookup: CoverLookup | null, canStream: boolean) {
  let found = false;
  if (lookup) {
    void queue(`${d.id}:${lookup.file ?? "torrent"}:lookup`, async () => {
      found = (await api.lookupCover(d.id, lookup)) !== null;
    });
  }
  if (!file || file.cover !== null) return;
  const inBrowser = canStream && canCapture(file, d.status);
  // The server's ffmpeg reads a complete file from disk: no stream link, so a paused torrent is fine.
  const onServer = () => serverCapture && file.progress >= 1;
  if (!inBrowser && !onServer()) return;
  void queue(captureKey(d.id, file), async () => {
    if (found) return;
    if (inBrowser) {
      try {
        const url = await api.streamFile(d.id, file.index);
        const frame = await captureFrame(url).catch(() => decodeFrame(url));
        return await api.uploadFileCover(d.id, file.index, frame);
      } catch {
        // No decoder in this browser: the server may have one.
      }
    }
    if (!onServer()) return;
    try {
      await api.captureFileCover(d.id, file.index);
    } catch (e) {
      if (e instanceof ApiError && e.kind === "unsupported") serverCapture = false;
    }
  });
}

/** On a torrent's page: looks its cover up (when the lookup is on) and captures a frame while it has none. */
export function useTorrentCover(d: TorrentDetails | null) {
  const { gate, coverLookup } = useUi();
  const canStream = !gate("stream");
  useEffect(() => {
    if (!d) return;
    const lookup = coverLookup ? torrentLookup(d.name, d.files, mediaEpisodes(d.files)) : null;
    ensureCover(d, d.cover === null ? mainVideo(d.files) : null, lookup, canStream);
  }, [d, coverLookup, canStream]);
}

/**
 * In the list: a row without a cover gets one once it is on screen, by the same steps as the torrent's page.
 * The list has no files, so the details are fetched once per torrent and session (again when it completes).
 */
export function useRowCover(torrent: Torrent, row: RefObject<HTMLElement | null>) {
  const { gate, coverLookup } = useUi();
  const canStream = !gate("stream");
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    });
    if (row.current) observer.observe(row.current);
    return () => observer.disconnect();
  }, [row]);
  const { id, name } = torrent;
  const missing = torrent.cover === null;
  const active = torrent.status === "downloading" || torrent.status === "seeding";
  const done = torrent.progress >= 1;
  useEffect(() => {
    if (!seen || !missing || !(active || done || coverLookup)) return;
    void queue(`${id}:row:${done ? "done" : "part"}`, async () => {
      const d = await api.get(id);
      if (d.cover !== null) return;
      ensureCover(d, mainVideo(d.files), coverLookup ? torrentLookup(name, d.files, mediaEpisodes(d.files)) : null, canStream);
    });
  }, [seen, id, name, missing, active, done, coverLookup, canStream]);
}
