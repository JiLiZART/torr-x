import { useEffect, useRef, useState } from "react";
import { Film } from "lucide-react";
import { api, type FileInfo, type TorrentDetails } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import { episodeLookup } from "../../lib/cover";
import type { EpisodeFile } from "../../lib/media";
import { ensureCover } from "./useCover";

/** An episode row's thumbnail: its cover once the row is on screen, else a placeholder of the same size. */
export function EpisodeThumb({ d, episode }: { d: TorrentDetails; episode: EpisodeFile<FileInfo> }) {
  const { gate, coverLookup } = useUi();
  const canStream = !gate("stream");
  const box = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  const file = episode.file;
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setSeen(true);
    });
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (seen && file.cover === null) ensureCover(d, file, coverLookup ? episodeLookup(episode, d.name) : null, canStream);
  }, [seen, d, file, episode, coverLookup, canStream]);
  return (
    <span ref={box} className="flex h-[44px] w-[76px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-ui-surface-3 text-ui-text-3">
      {seen && file.cover ? <img src={api.fileCoverUrl(d.id, file.index, file.cover)} alt="" className="h-full w-full object-cover" /> : <Film size={18} />}
    </span>
  );
}
