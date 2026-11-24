// The palette's pure logic: which mode the input puts it in, and how jump targets rank.
import type { FileHit } from "@torrentx/api-client";
import { compare, evaluate, FILE_SEARCH_SCOPE, parse, sortKeys, topItems, type Node, type ParseError } from "@torrentx/query";
import { fileRow, type FileRow } from "./detail.ts";

/** A torrent named by the palette: the scope chip, or the page the palette was opened on. */
export interface TorrentRef {
  id: string;
  name: string;
}

export type Mode =
  /** `>` prefix: commands only. */
  | { kind: "command"; text: string }
  /** Plain words: jump targets; never filters on its own. */
  | { kind: "jump"; text: string }
  /** A structured query (`field:value`) that parses: grouped sections. */
  | { kind: "query"; text: string; ast: Node }
  /** `@ `: files of every torrent, or of the scope chip's torrent. `ast` is null when the text does not parse. */
  | { kind: "files"; text: string; scope: TorrentRef | null; ast: Node | null; error: ParseError | null }
  /** `torrent: ` in file mode: choosing the torrent to search in. */
  | { kind: "pickTorrent"; text: string };

/** Chips sit before the input; Backspace on an empty input removes the last one. */
export type PaletteChip =
  | { kind: "command" }
  | { kind: "files" }
  /** Holds the file query typed before `torrent:`, given back once a torrent is picked or the pick is dropped. */
  | { kind: "torrentPending"; rest: string }
  | ({ kind: "torrent" } & TorrentRef);

export interface PaletteInput {
  chips: PaletteChip[];
  text: string;
}

const PICK = /(^|\s)torrent: $/i;

/** The input after the user changes its text to `value`; a typed prefix may become a chip. */
export function typeInto(input: PaletteInput, value: string, here: TorrentRef | null = null): PaletteInput {
  const { chips, text } = input;
  if (chips.length === 0) {
    if (text === "" && value.startsWith(">")) return { chips: [{ kind: "command" }], text: value.slice(1) };
    // `@` then Space on an otherwise empty input; on a torrent's page the search starts scoped to it.
    if (value.startsWith("@ ") && (text === "" || text === "@")) {
      return { chips: here ? [{ kind: "files" }, { kind: "torrent", ...here }] : [{ kind: "files" }], text: value.slice(2) };
    }
    return { chips, text: value };
  }
  const top = chips[chips.length - 1];
  const pick = top.kind === "files" ? PICK.exec(value) : null;
  if (pick) return { chips: [...chips, { kind: "torrentPending", rest: value.slice(0, pick.index).trimEnd() }], text: "" };
  return { chips, text: value };
}

/** Backspace on an empty input (and Escape while picking): drops the last chip. */
export function dropChip(input: PaletteInput): PaletteInput {
  const last = input.chips[input.chips.length - 1];
  if (!last) return input;
  return { chips: input.chips.slice(0, -1), text: last.kind === "torrentPending" ? last.rest : "" };
}

/** Turns the pending `torrent:` chip into the scope chip and gives the file query back. */
export function pickTorrent(input: PaletteInput, torrent: TorrentRef): PaletteInput {
  const last = input.chips[input.chips.length - 1];
  if (last?.kind !== "torrentPending") return input;
  return { chips: [...input.chips.slice(0, -1), { kind: "torrent", id: torrent.id, name: torrent.name }], text: last.rest };
}

export function paletteMode(input: PaletteInput): Mode {
  const top = input.chips[input.chips.length - 1];
  if (!top) return detectMode(input.text);
  if (top.kind === "command") return { kind: "command", text: input.text.trim() };
  if (top.kind === "torrentPending") return { kind: "pickTorrent", text: input.text };
  const scope = top.kind === "torrent" ? { id: top.id, name: top.name } : null;
  const { ast, error } = parse(input.text, FILE_SEARCH_SCOPE);
  return { kind: "files", text: input.text, scope, ast, error };
}

export interface FileResult extends FileRow {
  torrentId: string;
  torrentName: string;
}

export const FILE_LIMIT = 50;

/**
 * File-mode results, capped at FILE_LIMIT, plus how many more matched; null when there is nothing to search yet
 * (no scope and no query). Order: the query's `sort:`, else best name score for its words, else server order
 * (torrents in list order, files in torrent order).
 */
export function fileResults(hits: FileHit[], mode: Extract<Mode, { kind: "files" }>, now = Date.now() / 1000): { rows: FileResult[]; more: number } | null {
  const pool = (mode.scope ? hits.filter((h) => h.torrentId === mode.scope!.id) : hits).map(
    (h): FileResult => ({ ...fileRow(h), torrentId: h.torrentId, torrentName: h.torrentName }),
  );
  const cap = (rows: FileResult[]) => ({ rows: rows.slice(0, FILE_LIMIT), more: Math.max(0, rows.length - FILE_LIMIT) });
  if (mode.text.trim() === "") return mode.scope ? cap(pool) : null;
  if (!mode.ast) return { rows: [], more: 0 };
  const ast = mode.ast;
  const kept = pool.filter((r) => evaluate(ast, r, now));
  const keys = sortKeys(ast);
  if (keys.length > 0) return cap(kept.sort(compare(keys, FILE_SEARCH_SCOPE)));
  const words = topItems(ast).flatMap((n) => (n.type === "pred" && n.field === "name" && !n.negated ? [n.value.replace(/\*/g, "")] : [])).filter(Boolean);
  if (words.length === 0) return cap(kept);
  const total = (r: FileResult) => words.reduce((sum, w) => sum + (score(r.name, w) ?? 3), 0);
  return cap(
    kept
      .map((r, i) => ({ r, i, s: total(r) }))
      .sort((a, b) => a.s - b.s || a.i - b.i)
      .map((x) => x.r),
  );
}

export function detectMode(input: string): Mode {
  const text = input.trim();
  if (text.startsWith(">")) return { kind: "command", text: text.slice(1).trim() };
  // A bare word parses too (`name:*word*`); only an explicit field makes it a query.
  if (/(^|[\s(!])[a-z]+:/i.test(text)) {
    const { ast } = parse(text);
    if (ast) return { kind: "query", text, ast };
  }
  return { kind: "jump", text };
}

/** 0 = prefix, 1 = word prefix, 2 = substring; null = no match. */
export function score(haystack: string, needle: string): number | null {
  const h = haystack.toLowerCase();
  const n = needle.trim().toLowerCase();
  if (!n) return 2;
  if (h.startsWith(n)) return 0;
  if (new RegExp(`[\\s._\\-/:·(]${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(h)) return 1;
  return h.includes(n) ? 2 : null;
}

/** Matching items, best first; `boost` (e.g. pinned tabs) breaks ties before the original order. */
export function rank<T>(items: T[], needle: string, text: (item: T) => string[], boost: (item: T) => number = () => 0): T[] {
  return items
    .map((item, index) => {
      const scores = text(item)
        .map((s) => score(s, needle))
        .filter((s): s is number => s !== null);
      return { item, index, s: scores.length ? Math.min(...scores) : null };
    })
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s! - b.s! || boost(b.item) - boost(a.item) || a.index - b.index)
    .map((x) => x.item);
}
