// Episode and quality facts parsed from file names. Pure: nothing here is looked up or invented; a fact
// that is not in the name is null.

export const VIDEO_EXT = new Set(["mkv", "mp4", "m4v", "avi", "mov", "webm", "ts", "m2ts", "wmv", "mpg", "mpeg"]);
/** Containers a browser `<video>` can usually play: these get the built-in player, the rest an external one. */
export const INLINE_EXT = new Set(["mp4", "m4v", "webm", "mov"]);

const HEAD_MIN = 8 * 1024 * 1024;

/**
 * Bytes still missing before playback can start: the head is 2% of the file or 8 MiB, whichever is larger.
 * shortcut: counts all downloaded bytes of the file, not only its head (the model has no per-file pieces);
 * librqbit's stream fetches the head first anyway. Read the piece bitfield if this misleads.
 */
export function headNeed(file: { size: number; progress: number }): number {
  const head = Math.min(file.size, Math.max(file.size * 0.02, HEAD_MIN));
  return Math.max(0, Math.ceil(head - file.size * file.progress));
}

export interface Episode {
  season: number;
  ep: number;
  /** Words after the episode code and before the first quality token, when there are any. */
  title: string | null;
  /** Quality tokens in the order they appear: 2160p, DV, HDR10, DDP5.1, Atmos, … */
  quality: string[];
  /** The show part of the name, normalized: files of one show share it. */
  show: string;
}

const CODE = /(?:^|[\s._\-[(])s(\d{1,2})[\s._-]?e(\d{1,3})(?:[\s._\-\])]|$)|(?:^|[\s._\-[(])(\d{1,2})x(\d{2,3})(?:[\s._\-\])]|$)/i;
// Anime style, numbered within the show: `[Group] Show - 01 [1080p]`, `Show - 12v2.mkv`; read as season 1.
const ABSOLUTE = /^(?:\[[^\]]*\]\s*)?(.+?)\s+-\s+(\d{1,3})(?:v\d)?(?=$|[\s.[(])/i;
// Tokens shown as quality tags, and the ones that only end a title.
const QUALITY: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^(2160|1080|720|576|480)[pi]$/i, (m) => `${m[1]}p`],
  [/^4k$/i, () => "2160p"],
  [/^(dv|dovi)$/i, () => "DV"],
  [/^hdr10(\+|plus)$/i, () => "HDR10+"],
  [/^hdr10$/i, () => "HDR10"],
  [/^hdr$/i, () => "HDR"],
  [/^(ddp|dd\+|eac3)(\d\.\d)?$/i, (m) => `DDP${m[2] ?? ""}`],
  [/^(dd|ac3)(\d\.\d)$/i, (m) => `DD${m[2]}`],
  [/^truehd$/i, () => "TrueHD"],
  [/^atmos$/i, () => "Atmos"],
];
const STOP = /^(web|webrip|web-dl|webdl|bluray|blu-ray|bdrip|brrip|hdtv|dvdrip|remux|x26[45]|h\.?26[45]|hevc|avc|aac|10bit|8bit|proper|repack|multi|uhd|nf|amzn|atvp|dsnp|hmax)$/i;

/** Splits on dots, spaces, underscores; keeps `DDP5.1`, `H.265` and `5.1` together. */
function tokens(text: string): string[] {
  return text
    .replace(/(\d)\.(\d)(?!\d)/g, "$1·$2")
    .split(/[\s._]+/)
    .map((t) => t.replaceAll("·", "."))
    .filter(Boolean);
}

/** The quality tags named in `name` (any file, not only episodes). */
export function qualityTags(name: string): string[] {
  const tags: string[] = [];
  for (const raw of tokens(name)) {
    // `DDP5.1.Atmos` and `DTS-HD.MA` arrive split; `HDR10-DV` style joins arrive whole.
    for (const token of raw.split("-")) {
      for (const [re, label] of QUALITY) {
        const m = re.exec(token);
        if (m && !tags.includes(label(m))) tags.push(label(m));
      }
    }
  }
  return tags;
}

const stem = (fileName: string) => fileName.replace(/\.[a-z0-9]{2,4}$/i, "");

export function parseEpisode(path: string): Episode | null {
  const base = stem(path.split("/").pop() ?? path);
  const m = CODE.exec(base);
  const a = m ? null : ABSOLUTE.exec(base);
  if (!m && !a) return null;
  const season = m ? Number(m[1] ?? m[3]) : 1;
  const ep = m ? Number(m[2] ?? m[4]) : Number(a![2]);
  const show = (m ? base.slice(0, m.index) : a![1])
    .replace(/[\s._\-[(]+/g, " ")
    .trim()
    .toLowerCase();
  const after = tokens(m ? base.slice(m.index + m[0].length) : base.slice(a![0].length));
  const titleWords: string[] = [];
  for (const t of after) {
    if (/^[-–—:]+$/.test(t)) continue; // separators between code and title
    if (QUALITY.some(([re]) => re.test(t)) || STOP.test(t) || /^\d{4}$/.test(t) || t.startsWith("[")) break;
    titleWords.push(t);
  }
  // A trailing release group (`-GROUP`) is not part of the title.
  const title = titleWords.join(" ").replace(/-[A-Za-z0-9]+$/, "").trim();
  return { season, ep, title: title || null, quality: qualityTags(base), show };
}

export interface MediaFile {
  index: number;
  path: string;
  size: number;
  /** 0..1 */
  progress: number;
  wanted: boolean;
}

export interface EpisodeFile<F extends MediaFile = MediaFile> extends Episode {
  file: F;
}

/**
 * The episodes of one show when the torrent clearly is a season pack: at least two video files that parse
 * as episodes and share one show name. Null otherwise; media mode is then not offered.
 */
export function mediaEpisodes<F extends MediaFile>(files: F[]): EpisodeFile<F>[] | null {
  const episodes: EpisodeFile<F>[] = [];
  for (const file of files) {
    const ext = file.path.split(".").pop()?.toLowerCase() ?? "";
    if (!VIDEO_EXT.has(ext) || /(^|\/)(sample|extras?|featurettes?)(\/|[._-])/i.test(file.path)) continue;
    const parsed = parseEpisode(file.path);
    if (parsed) episodes.push({ ...parsed, file });
  }
  if (episodes.length < 2) return null;
  const shows = new Set(episodes.map((e) => e.show).filter(Boolean));
  if (shows.size > 1) return null;
  return episodes.sort((a, b) => a.season - b.season || a.ep - b.ep);
}

export type EpisodeState = "ready" | "downloading" | "queued" | "skipped";

/** `ready` = fully downloaded; whether an unfinished file can start streaming is `headNeed`. */
export function episodeState(file: MediaFile, torrentActive: boolean): EpisodeState {
  if (!file.wanted) return "skipped";
  if (file.progress >= 1) return "ready";
  return torrentActive && file.progress > 0 ? "downloading" : "queued";
}

/** `S02E04`. */
export const episodeCode = (e: Pick<Episode, "season" | "ep">) =>
  `S${String(e.season).padStart(2, "0")}E${String(e.ep).padStart(2, "0")}`;
