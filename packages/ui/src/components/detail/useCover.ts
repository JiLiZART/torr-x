import { useEffect, useState, type RefObject } from "react";
import { api, type CoverLookup, type FileInfo, type Torrent, type TorrentDetails } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import { canCapture, captureFrame, captureKey, mainVideo, onceQueue, torrentLookup } from "../../lib/cover";
import { mediaEpisodes } from "../../lib/media";

/** One lookup or capture at a time for the whole app; nothing is retried within a session. */
const queue = onceQueue();

/**
 * Gets a cover for a video file (and, for the torrent's main video, the torrent): the online lookup first
 * when it is on, since a poster outranks a frame, then a captured frame. Failures are silent: no cover is
 * a normal state.
 */
export function ensureCover(d: TorrentDetails, file: FileInfo | null, lookup: CoverLookup | null, canStream: boolean) {
  let found = false;
  if (lookup) {
    void queue(`${d.id}:${lookup.file ?? "torrent"}:lookup`, async () => {
      found = (await api.lookupCover(d.id, lookup)) !== null;
    });
  }
  if (file && file.cover === null && canStream && canCapture(file, d.status)) {
    void queue(captureKey(d.id, file), async () => {
      if (found) return;
      const frame = await captureFrame(await api.streamFile(d.id, file.index));
      await api.uploadFileCover(d.id, file.index, frame);
    });
  }
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
    if (!seen || !missing || !(active || coverLookup)) return;
    void queue(`${id}:row:${done ? "done" : "part"}`, async () => {
      const d = await api.get(id);
      if (d.cover !== null) return;
      ensureCover(d, mainVideo(d.files), coverLookup ? torrentLookup(name, d.files, mediaEpisodes(d.files)) : null, canStream);
    });
  }, [seen, id, name, missing, active, done, coverLookup, canStream]);
}
