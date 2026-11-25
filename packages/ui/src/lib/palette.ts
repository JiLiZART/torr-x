// The palette's pure logic: which mode the input puts it in, and how jump targets rank.
import type { FileHit } from "@torrentx/api-client";
import { compare, complete, evaluate, FIELDS, FILE_SEARCH_SCOPE, parse, sortKeys, topItems, type Node, type ParseError } from "@torrentx/query";
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
  /** A query being typed: a known `field:` that does not parse yet (`size:`), or the `:` field shortcut (`:si`). */
  | { kind: "draft"; text: string; error: ParseError | null }
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

/** Every predicate and sort of a query, groups flattened. */
function leaves(node: Node): Node[] {
  return node.type === "and" || node.type === "or" ? node.items.flatMap(leaves) : [node];
}

/** True when the item at `column` was typed as `field:…` (not a bare word). */
const named = (text: string, column: number) => /^!?[A-Za-z]+:/.test(text.slice(column));

export interface TokenSpan {
  text: string;
  kind: "plain" | "field" | "value";
}

/** The input split for drawing: each `field:value` becomes a field span and a value span; the rest stays plain. */
export function tokenSpans(text: string): TokenSpan[] {
  const { ast } = parse(text);
  const spans: TokenSpan[] = [];
  let at = 0;
  const plain = (to: number) => {
    if (to > at) spans.push({ text: text.slice(at, to), kind: "plain" });
  };
  const items = ast ? leaves(ast).filter((n): n is Extract<Node, { column: number }> => n.type !== "and" && n.type !== "or") : [];
  for (const item of items.sort((a, b) => a.column - b.column)) {
    if (!named(text, item.column)) continue;
    const end = item.column + item.length;
    const colon = text.indexOf(":", item.column) + 1;
    plain(item.column);
    spans.push({ text: text.slice(item.column, colon), kind: "field" });
    if (end > colon) spans.push({ text: text.slice(colon, end), kind: "value" });
    at = end;
  }
  plain(text.length);
  return spans;
}

/** Default name for a tab saved from `text`: the values of its plain `field:value` predicates, joined by ` · `. */
export function suggestTabName(text: string, ast: Node): string {
  return topItems(ast)
    .flatMap((n) => (n.type === "pred" && !n.negated && n.op === "=" && !n.value.includes("..") && named(text, n.column) ? [n.value] : []))
    .join(" · ");
}

/** Words the query names (values and sort keys), for jump matches by name. */
export function queryWords(ast: Node): string[] {
  const words = leaves(ast).flatMap((n) => (n.type === "pred" ? (n.negated ? [] : [n.value]) : n.type === "sort" ? n.keys.map((k) => k.field) : []));
  return [...new Set(words.map((w) => w.replace(/\*/g, "").toLowerCase()))].filter((w) => w.length >= 2);
}

/** Files whose name contains one of `words`, best `score` first, then server order. */
export function fileJumps(hits: FileHit[], words: string[], limit: number): FileResult[] {
  if (words.length === 0) return [];
  return hits
    .map((h, i) => {
      const row: FileResult = { ...fileRow(h), torrentId: h.torrentId, torrentName: h.torrentName };
      const scores = words.map((w) => score(row.name, w)).filter((s): s is number => s !== null);
      return { row, i, s: scores.length ? Math.min(...scores) : null };
    })
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s! - b.s! || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.row);
}

/** The palette's `:` shortcut at the end of the input: `:`, `:si`, `state:active !:ta`. */
const FIELD_SHORTCUT = /(?:^|[\s(])!?:([a-z]*)$/i;
const isField = (name: string) => name.toLowerCase() in FIELDS || name.toLowerCase() === "sort";

/** `:size ` + space becomes `size:`, so the language itself never sees the shortcut. */
export function expandFieldShortcut(text: string): string {
  return text.replace(/(^|[\s(])(!?):([a-z]+)\s$/i, (m, pre: string, neg: string, field: string) =>
    isField(field) ? `${pre}${neg}${field.toLowerCase()}:` : m,
  );
}

/** Draft mode completions: field names after `:`, else what the query language offers at the end of the text. */
export function draftCompletion(text: string, values: Partial<Record<string, string[]>>): { from: number; options: string[] } {
  const short = FIELD_SHORTCUT.exec(text);
  if (short) return { from: text.length - short[1].length - 1, options: complete(short[1], short[1].length, values).options };
  // `size: ` still means "size needs a value": complete against the text before the trailing space.
  const head = /:\s+$/.test(text) ? text.trimEnd() : text;
  const { from, options } = complete(head, head.length, values);
  return { from, options };
}

export function detectMode(input: string): Mode {
  const text = input.trim();
  if (text.startsWith(">")) return { kind: "command", text: text.slice(1).trim() };
  if (FIELD_SHORTCUT.test(text)) return { kind: "draft", text, error: null };
  // A bare word parses too (`name:*word*`); only an explicit field makes it a query.
  if (/(^|[\s(!])[a-z]+:/i.test(text)) {
    const { ast, error } = parse(text);
    if (ast) return { kind: "query", text, ast };
    // An unknown field (`statu:`) is more likely a word than a query; a known one is a query being typed.
    const known = [...text.matchAll(/(?:^|[\s(!])([a-z]+):/gi)].some(([, f]) => isField(f));
    if (error && known) return { kind: "draft", text, error };
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
