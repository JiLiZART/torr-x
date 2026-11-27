// Detail page data, pure: section rows for the query scopes, tracker/web-seed status words, swarm totals and
// the format → file-actions table.
import type { FileInfo, Peer, Tracker, WebSeed } from "@torrentx/api-client";
import { PEER_FLAGS } from "@torrentx/query";
import { parseEpisode, VIDEO_EXT } from "./media.ts";

export const SECTIONS = ["files", "overview", "peers", "trackers", "webseeds", "pieces"] as const;
export type Section = (typeof SECTIONS)[number];
export const isSection = (s: string): s is Section => (SECTIONS as readonly string[]).includes(s);

export const extOf = (path: string) => {
  const name = path.split("/").pop() ?? path;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
};

export type FilePriorityWord = "high" | "normal" | "low" | "skip";

export interface FileRow {
  index: number;
  name: string;
  path: string;
  ext: string;
  size: number;
  /** 0–100 */
  done: number;
  priority: FilePriorityWord;
  ep: number | null;
  season: number | null;
}

export function fileRow(f: FileInfo): FileRow {
  const episode = parseEpisode(f.path);
  return {
    index: f.index,
    name: f.path.split("/").pop() ?? f.path,
    path: f.path,
    ext: extOf(f.path),
    size: f.size,
    done: Math.round(f.progress * 1000) / 10,
    // Skip is "not wanted": one menu for both.
    priority: f.wanted ? f.priority : "skip",
    ep: episode?.ep ?? null,
    season: episode?.season ?? null,
  };
}

export interface PeerRow {
  address: string;
  country: string | null;
  client: string | null;
  /** Flag words for the query; `letters` for the cell. */
  flags: string[];
  letters: string[];
  /** 0–100, null when unknown. */
  progress: number | null;
  down: number;
  up: number;
  encryption: string | null;
}

export function peerRow(p: Peer): PeerRow {
  const letters = [...(p.flags ?? "").replace(/\s/g, "")];
  return {
    address: p.address,
    country: p.country,
    client: p.client,
    letters,
    flags: [...new Set(letters.flatMap((l) => (PEER_FLAGS[l] ? [PEER_FLAGS[l]] : [])))],
    progress: p.progress == null ? null : Math.round(p.progress * 1000) / 10,
    down: p.downloadRate,
    up: p.uploadRate,
    encryption: p.encryption,
  };
}

export type TrackerStatusWord = "working" | "updating" | "not working" | "disabled" | "unknown";

/** Engine status text → one of the drawn words; failure text is kept separately. */
export function trackerStatus(t: Tracker): TrackerStatusWord {
  const s = t.status?.toLowerCase() ?? "";
  if (t.error) return "not working";
  if (s === "working") return "working";
  if (s === "announcing" || s === "updating" || s === "scraping") return "updating";
  if (s === "inactive" || s === "disabled") return "disabled";
  if (s === "" || s === "not contacted") return "unknown";
  return "not working";
}

export interface TrackerRow {
  url: string;
  kind: Tracker["kind"];
  tier: number | null;
  status: TrackerStatusWord;
  seeds: number | null;
  leechers: number | null;
  tracker: Tracker;
}

export const trackerRow = (t: Tracker): TrackerRow => ({
  url: t.url,
  kind: t.kind,
  tier: t.tier,
  status: trackerStatus(t),
  seeds: t.seeds,
  leechers: t.leechers,
  tracker: t,
});

export interface WebSeedRow {
  url: string;
  type: WebSeed["kind"];
  /** `failed` when the engine reports an error; the engine's word otherwise; null when silent. */
  status: string | null;
  speed: number | null;
  seed: WebSeed;
}

export const webSeedRow = (w: WebSeed): WebSeedRow => ({
  url: w.url,
  type: w.kind,
  status: w.error ? "failed" : w.status,
  speed: w.speed,
  seed: w,
});

/** The swarm size trackers report: the largest scrape, or null when none reported one. */
export function swarm(trackers: Tracker[]): { seeds: number | null; leechers: number | null } {
  const max = (values: (number | null)[]) => {
    const known = values.filter((v): v is number => v !== null);
    return known.length ? Math.max(...known) : null;
  };
  return { seeds: max(trackers.map((t) => t.seeds)), leechers: max(trackers.map((t) => t.leechers)) };
}

export type FileClass = "video" | "disc" | "other";
export type FileAction = "play" | "library" | "cast" | "contents" | "mount" | "open" | "reveal" | "copyPath";

const DISC_EXT = new Set(["iso", "img", "dmg", "bin", "cue", "zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz"]);

export function fileClass(ext: string): FileClass {
  if (VIDEO_EXT.has(ext)) return "video";
  if (DISC_EXT.has(ext)) return "disc";
  return "other";
}

/** The actions a row offers, by its format. */
export const FILE_ACTIONS: Record<FileClass, FileAction[]> = {
  video: ["play", "library", "cast"],
  disc: ["contents", "mount"],
  other: ["open", "reveal", "copyPath"],
};

/**
 * Why an action cannot run here, or null when it can. `openFile` and `stream` come from the capability matrix;
 * `local` says the browser runs on the machine that runs TorrentX (the server refuses remote opens).
 * Play opens a finished file on that machine, streams an unfinished one, and from elsewhere copies a stream link.
 * `need` = bytes still missing from the file's head (`headNeed`); streaming waits for them.
 */
export function fileActionBlock(
  action: FileAction,
  ctx: { openFile: string | undefined; stream: string | undefined; local: boolean; done: boolean; need?: number },
): "notYet" | "engine" | "remote" | "notOnDisk" | "notReady" | null {
  switch (action) {
    case "play":
      if (ctx.done && ctx.local) return ctx.openFile ? "engine" : null;
      if (ctx.stream) return ctx.done ? "remote" : "engine";
      return !ctx.done && (ctx.need ?? 0) > 0 ? "notReady" : null;
    case "library":
    case "cast":
    case "contents":
    case "mount":
      return "notYet";
    case "open":
    case "reveal":
      if (ctx.openFile) return "engine";
      if (!ctx.local) return "remote";
      return action === "open" && !ctx.done ? "notOnDisk" : null;
    case "copyPath":
      return null;
  }
}

/** Joins a save path and a file path with the save path's own separator. */
export function joinPath(dir: string, file: string): string {
  const sep = dir.includes("\\") && !dir.includes("/") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${sep}${sep === "\\" ? file.replace(/\//g, "\\") : file}`;
}

// ---- file kinds and the file tree ---------------------------------------------------------------

/** What a file is, by extension: picks its icon the way a file manager would. */
export type FileKind = "video" | "audio" | "image" | "subtitle" | "text" | "document" | "sheet" | "code" | "data" | "archive" | "disc" | "font" | "executable" | "other";

const KIND_EXT: [FileKind, string[]][] = [
  ["video", [...VIDEO_EXT, "flv", "3gp", "vob", "ogv"]],
  ["audio", ["mp3", "flac", "wav", "aac", "m4a", "ogg", "opus", "wma", "alac", "ape", "aiff", "dsf"]],
  ["image", ["jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif", "svg", "heic", "avif", "ico", "raw"]],
  ["subtitle", ["srt", "ass", "ssa", "sub", "idx", "vtt", "sup"]],
  ["text", ["txt", "nfo", "md", "log", "sfv", "rtf"]],
  ["document", ["pdf", "epub", "mobi", "azw3", "djvu", "doc", "docx", "odt", "cbz", "cbr", "fb2"]],
  ["sheet", ["xls", "xlsx", "ods", "csv", "tsv"]],
  ["code", ["js", "ts", "py", "rs", "go", "c", "cpp", "h", "java", "sh", "html", "css", "php", "rb", "lua"]],
  ["data", ["json", "xml", "yaml", "yml", "toml", "ini", "cfg", "conf", "db", "sqlite", "torrent"]],
  ["archive", ["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst", "r00", "r01"]],
  ["disc", ["iso", "img", "dmg", "bin", "cue", "mdf", "mds", "nrg", "vhd"]],
  ["font", ["ttf", "otf", "woff", "woff2"]],
  ["executable", ["exe", "msi", "app", "apk", "deb", "rpm", "pkg", "appimage", "bat", "cmd"]],
];
const KIND_OF = new Map(KIND_EXT.flatMap(([kind, exts]) => exts.map((ext) => [ext, kind] as const)));

export const fileKind = (ext: string): FileKind => KIND_OF.get(ext) ?? (/^r\d\d$/.test(ext) ? "archive" : "other");

export interface TreeDir {
  kind: "dir";
  name: string;
  /** Folder path inside the torrent: the key that remembers it collapsed. */
  path: string;
  children: TreeNode[];
  size: number;
  /** 0–100, weighted by size. */
  done: number;
  /** Every file below, for folder-wide changes. */
  indices: number[];
  wanted: "all" | "some" | "none";
}
export type TreeNode = TreeDir | { kind: "file"; row: FileRow };

/** Rows as folders and files: folders first (by name), files in the order given. */
export function fileTree(rows: FileRow[]): TreeNode[] {
  const root: TreeDir = { kind: "dir", name: "", path: "", children: [], size: 0, done: 0, indices: [], wanted: "none" };
  for (const row of rows) {
    const parts = row.path.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      const path = dir.path ? `${dir.path}/${part}` : part;
      let next = dir.children.find((c): c is TreeDir => c.kind === "dir" && c.path === path);
      if (!next) {
        next = { kind: "dir", name: part, path, children: [], size: 0, done: 0, indices: [], wanted: "none" };
        dir.children.push(next);
      }
      dir = next;
    }
    dir.children.push({ kind: "file", row });
  }
  const byIndex = new Map(rows.map((r) => [r.index, r]));
  const finish = (dir: TreeDir): TreeDir => {
    const dirs = dir.children.filter((c): c is TreeDir => c.kind === "dir").map(finish).sort((a, b) => a.name.localeCompare(b.name));
    const files = dir.children.filter((c) => c.kind === "file");
    const leaves = [...dirs.flatMap((d) => d.indices.map((i) => byIndex.get(i)!)), ...files.map((f) => f.row)];
    const size = leaves.reduce((n, r) => n + r.size, 0);
    const wanted = leaves.filter((r) => r.priority !== "skip").length;
    return {
      ...dir,
      children: [...dirs, ...files],
      size,
      done: size > 0 ? Math.round((leaves.reduce((n, r) => n + (r.size * r.done) / 100, 0) / size) * 1000) / 10 : 0,
      indices: leaves.map((r) => r.index),
      wanted: wanted === 0 ? "none" : wanted === leaves.length ? "all" : "some",
    };
  };
  return finish(root).children;
}

/** The tree as visible lines: folders in `collapsed` hide what is inside them. */
export function treeLines(nodes: TreeNode[], collapsed: Set<string>, depth = 0): { node: TreeNode; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...(node.kind === "dir" && !collapsed.has(node.path) ? treeLines(node.children, collapsed, depth + 1) : []),
  ]);
}
