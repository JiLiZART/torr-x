// Covers: what to look up, when a frame can be captured, and the capture itself. Everything except
// `captureFrame` is pure and tested.
import type { CoverLookup, Status } from "@torrentx/api-client";
import { VIDEO_EXT, type EpisodeFile, type MediaFile } from "./media.ts";

/** Where the frame is taken: WebTorrent Desktop's formula. An unknown duration counts as 10 minutes. */
export const seekTime = (duration: number) => Math.min((duration || 600) * 0.03, 60);

/** The containers a frame is captured from (WebTorrent Desktop's list). */
export const CAPTURE_EXT = new Set(["avi", "mp4", "m4v", "webm", "mov", "mkv", "mpg", "mpeg", "ogv", "wmv", "m2ts"]);
const capturable = (path: string) => CAPTURE_EXT.has(path.split(".").pop()?.toLowerCase() ?? "");

/** The frame scaled down to at most `max` pixels wide. */
export function frameSize(width: number, height: number, max = 640): { width: number; height: number } {
  return width <= max ? { width, height } : { width: max, height: Math.round((height * max) / width) };
}

const QUALITY_CUT = /[\s([](?:2160p|1080[pi]|720p|576p|480p|4k|uhd|blu-?ray|web(?:-?dl|rip)?|hdtv|dvdrip|bdrip|brrip|remux|[xh] ?26[45]|hevc|s\d{1,2}(?:e\d+)?|season)(?=[\s)\]]|$)/i;
const YEAR = /[\s([]((?:19|20)\d{2})(?=[\s)\]]|$)/g;

/**
 * The title and year a release name states: `Big.Buck.Bunny.2008.1080p.x264-GRP` is "Big Buck Bunny", 2008.
 * The year is the last one before the quality words, so `Blade Runner 2049 2017` keeps its title.
 */
export function parseTitle(name: string): { title: string; year?: number } {
  const ext = /\.([a-z0-9]{2,4})$/i.exec(name);
  const stem = ext && VIDEO_EXT.has(ext[1].toLowerCase()) ? name.slice(0, ext.index) : name;
  const flat = stem.replace(/^\[[^\]]*\]\s*/, "").replace(/[._]+/g, " ").trim();
  const cut = QUALITY_CUT.exec(flat);
  const head = cut ? flat.slice(0, cut.index) : flat;
  const year = [...head.matchAll(YEAR)].pop();
  const title = (year ? head.slice(0, year.index) : head).replace(/[\s\-([]+$/, "").trim();
  return title ? { title, ...(year ? { year: Number(year[1]) } : {}) } : { title: flat };
}

/** The file whose frame stands for the torrent: its largest video file. */
export function mainVideo<F extends MediaFile>(files: F[]): F | null {
  return files.filter((f) => capturable(f.path)).reduce<F | null>((best, f) => (best && best.size >= f.size ? best : f), null);
}

/** What to look up for a torrent: a show when its files are episodes, else a movie. Null when it is not a video torrent. */
export function torrentLookup(name: string, files: MediaFile[], episodes: EpisodeFile[] | null): CoverLookup | null {
  if (!mainVideo(files)) return null;
  const show = episodes?.[0]?.show;
  return episodes ? { kind: "tv", ...parseTitle(show || name) } : { kind: "movie", ...parseTitle(name) };
}

/** What to look up for one episode file. */
export function episodeLookup(e: EpisodeFile, torrentName: string): CoverLookup {
  return { kind: "tv", ...parseTitle(e.show || torrentName), season: e.season, episode: e.ep, file: e.file.index };
}

/**
 * Whether a frame capture is worth trying. A stream link resumes a paused torrent and wants the file, so
 * capture never runs for a paused torrent or a skipped file; a file that just started has nothing to show.
 */
export function canCapture(file: MediaFile, status: Status): boolean {
  return file.wanted && (status === "downloading" || status === "seeding") && file.progress >= 0.1;
}

/** One attempt while the file downloads and one when it is complete. */
export const captureKey = (id: string, file: MediaFile) => `${id}:${file.index}:${file.progress >= 1 ? "done" : "part"}`;

/** Runs jobs one at a time; a key is tried once per session, whatever the outcome. */
export function onceQueue(): (key: string, job: () => Promise<unknown>) => Promise<void> {
  const tried = new Set<string>();
  let tail: Promise<void> = Promise.resolve();
  return (key, job) => {
    if (tried.has(key)) return Promise.resolve();
    tried.add(key);
    tail = tail.then(job).then(
      () => undefined,
      () => undefined,
    );
    return tail;
  };
}

/**
 * One frame of the video at `url` as a JPEG, with no sound and no visible player. The URL must be
 * same-origin (the stream endpoint is), or the canvas cannot be read. Rejects when the browser cannot
 * decode the file (often MKV and HEVC) or nothing arrives in time.
 */
export function captureFrame(url: string, timeoutMs = 20_000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const stop = (error?: Error) => {
      clearTimeout(timer);
      video.onerror = video.onloadedmetadata = video.onseeked = null;
      video.removeAttribute("src");
      video.load();
      if (error) reject(error);
    };
    const timer = setTimeout(() => stop(new Error("no frame in time")), timeoutMs);
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.onerror = () => stop(new Error("cannot decode"));
    video.onloadedmetadata = () => {
      video.currentTime = seekTime(video.duration);
    };
    video.onseeked = () => {
      const { width, height } = frameSize(video.videoWidth, video.videoHeight);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx || width === 0) return stop(new Error("no frame"));
      ctx.drawImage(video, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          stop();
          if (blob) resolve(blob);
          else reject(new Error("no frame"));
        },
        "image/jpeg",
        0.8,
      );
    };
    video.src = url;
  });
}

/**
 * The same frame for a file `<video>` rejects (MKV above all): the container is read in JS over range
 * requests and one frame is decoded with the system's decoder (WebCodecs). Rejects when the browser has
 * no decoder for the codec.
 */
export async function decodeFrame(url: string, timeoutMs = 30_000): Promise<Blob> {
  const { ALL_FORMATS, CanvasSink, Input, UrlSource } = await import("mediabunny");
  const source = new UrlSource(new URL(url, location.href), { getRetryDelay: () => null });
  const input = new Input({ source, formats: ALL_FORMATS });
  const frame = async () => {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) throw new Error("cannot decode");
    const { width } = frameSize(track.displayWidth, track.displayHeight);
    const at = seekTime((await input.getDurationFromMetadata()) ?? NaN);
    const shot = await new CanvasSink(track, { width }).getCanvas(at);
    if (!shot) throw new Error("no frame");
    const canvas = shot.canvas;
    if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
    return new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("no frame"))), "image/jpeg", 0.8));
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => (timer = setTimeout(() => reject(new Error("no frame in time")), timeoutMs)));
  try {
    return await Promise.race([frame(), late]);
  } finally {
    clearTimeout(timer);
    input.dispose();
  }
}
