// The palette's pure logic: which mode the input puts it in, and how jump targets rank.
import { parse, type Node } from "@torrentx/query";

export type Mode =
  /** `>` prefix: commands only. */
  | { kind: "command"; text: string }
  /** Plain words: jump targets; never filters on its own. */
  | { kind: "jump"; text: string }
  /** A structured query (`field:value`) that parses: grouped sections. */
  | { kind: "query"; text: string; ast: Node };

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
