// The add flow's pure side: what is being added, and file rows the query language can filter.
import type { Preview } from "@torrentx/api-client";
import type { Row } from "@torrentx/query";

export type AddSource = { kind: "uri"; uri: string } | { kind: "file"; file: File };

export const MAGNET = /^magnet:\?\S*xt=urn:btih:/i;
export const HTTP_URL = /^https?:\/\/\S+$/i;
/** A link that is obviously a torrent: the palette goes straight to the add flow. */
export const isTorrentLink = (text: string) => MAGNET.test(text) || /^https?:\/\/\S+\.torrent(\?\S*)?$/i.test(text);

/** How long a magnet may take to resolve before "add anyway" is offered. */
export const METADATA_TIMEOUT_MS = 30_000;

/** `dn=` of a magnet link, else the file name or the URL's last segment. */
export function sourceName(source: AddSource): string {
  if (source.kind === "file") return source.file.name.replace(/\.torrent$/i, "");
  const dn = /[?&]dn=([^&]+)/.exec(source.uri)?.[1];
  if (dn) return decodeURIComponent(dn.replace(/\+/g, " "));
  return source.uri.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? source.uri;
}

export interface PreviewFileRow extends Row {
  index: number;
  path: string;
}

/** A preview file as a row the query language reads: `name` is the base name, `path` the full path. */
export function fileRow(file: Preview["files"][number]): PreviewFileRow {
  const name = file.path.split("/").pop() ?? file.path;
  const dot = name.lastIndexOf(".");
  return {
    index: file.index,
    path: file.path,
    name,
    ext: dot > 0 ? name.slice(dot + 1).toLowerCase() : "",
    savePath: file.path,
    size: file.size,
    status: "",
    tags: [],
    tracker: null,
    progress: 0,
    ratio: null,
    seeds: 0,
    peers: 0,
    downloadRate: 0,
    uploadRate: 0,
    etaSecs: null,
    addedAt: 0,
  };
}

/** Indices to toggle: `all` and `none` act on the shown files; `invert` flips them. */
export function selectShown(selected: Set<number>, shown: number[], how: "all" | "none" | "invert"): Set<number> {
  const next = new Set(selected);
  for (const index of shown) {
    if (how === "all" || (how === "invert" && !selected.has(index))) next.add(index);
    else next.delete(index);
  }
  return next;
}
