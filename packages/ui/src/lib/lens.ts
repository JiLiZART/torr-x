// Scope / lens / query glue (pure): the lens is extra query text ANDed onto the tab query, kept in
// memory per tab. Everything here goes through @torrentx/query; nothing else parses or orders.
import {
  chips,
  evaluate,
  FIELDS,
  format,
  formatSort,
  parse,
  sortKeys,
  toggleSort,
  topItems,
  type Field,
  type Node,
  type Row,
  type SortKey,
} from "@torrentx/query";

export interface Lens {
  /** The fuzzy name input: a `name:*text*` predicate that is not a chip. */
  fuzzy: string;
  /** Always parseable: only valid predicates are ever added. */
  query: string;
}

export const NO_LENS: Lens = { fuzzy: "", query: "" };

export const hasLens = (lens: Lens) => lens.fuzzy.trim() !== "" || lens.query.trim() !== "";

const items = (text: string): Node[] => {
  const ast = parse(text).ast;
  return ast ? topItems(ast) : [];
};
const join = (nodes: Node[]) => format({ type: "and", items: nodes });
const quote = (value: string) => (/[\s()]/.test(value) ? `"${value}"` : value);

export function fuzzyNode(fuzzy: string): Node | null {
  const text = fuzzy.trim().replace(/"/g, "");
  return text ? parse(`name:"*${text}*"`).ast : null;
}

/** Predicates in the lens, sort excluded: the funnel count and the top bar badge. */
export const predicateCount = (query: string) => chips(parse(query).ast ?? { type: "and", items: [] }).filter((c) => c.kind !== "sort").length;

/** Appends predicates; `extra` must parse. */
export const addChips = (query: string, extra: string) => join([...items(query), ...items(extra)]);

export const removeChip = (query: string, index: number) => join(items(query).filter((_, i) => i !== index));

/** Flips negation of a predicate chip; groups and sort stay as they are. */
export function negateChip(query: string, index: number): string {
  return join(items(query).map((item, i) => (i === index && item.type === "pred" ? { ...item, negated: !item.negated } : item)));
}

export function moveChip(query: string, from: number, to: number): string {
  const list = items(query);
  const [moved] = list.splice(from, 1);
  if (!moved) return query;
  list.splice(to, 0, moved);
  return join(list);
}

/** A column header click: edits the lens's sort chip, starting from the order in effect. */
export function clickSort(query: string, tabKeys: SortKey[], field: Field): string {
  const list = items(query);
  const own = list.flatMap(sortKeys);
  const next = toggleSort(own.length > 0 ? own : tabKeys, field);
  return join([...list.filter((item) => item.type !== "sort"), ...items(formatSort(next))]);
}

/** Tab query AND lens as one query: what "Save as tab" stores. The lens's sort replaces the tab's. */
export function combine(tab: Node, lens: Lens): string {
  const own = items(lens.query);
  const fuzzy = fuzzyNode(lens.fuzzy);
  const lensSorts = own.some((item) => item.type === "sort");
  const base = topItems(tab).filter((item) => !(lensSorts && item.type === "sort"));
  const all = [...base, ...(fuzzy ? [fuzzy] : []), ...own];
  // Canonical shape: filters first, sort last.
  return join([...all.filter((item) => item.type !== "sort"), ...all.filter((item) => item.type === "sort")]);
}

/** Canonical text, or the text itself when it does not parse. */
export function canonical(query: string): string {
  const ast = parse(query).ast;
  return ast ? format(ast) : query.trim();
}

export interface Blame {
  source: "tab" | "fuzzy" | "lens";
  /** Canonical text of the predicate that emptied the list. */
  text: string;
  /** Index among the top-level predicates of its source. */
  index: number;
}

/** Applies the tab query, then the lens, predicate by predicate: the first one that leaves nothing. */
export function blame(rows: Row[], tab: Node, fuzzy: Node | null, lens: Node | null, now = Date.now() / 1000): Blame | null {
  let left = rows;
  const stages: [Blame["source"], Node | null][] = [
    ["tab", tab],
    ["fuzzy", fuzzy],
    ["lens", lens],
  ];
  for (const [source, node] of stages) {
    if (!node) continue;
    const list = topItems(node);
    for (let index = 0; index < list.length; index++) {
      left = left.filter((row) => evaluate(list[index], row, now));
      if (left.length === 0) return { source, text: chips(list[index])[0].text, index };
    }
  }
  return null;
}

interface Grouped {
  name: string;
  query: string;
  pinned: boolean;
  group: string | null;
}

/** Sidebar sections are derived: pinned, then named or grouped tabs, then tabs named by their query. */
export function sections<T extends Grouped>(tabs: T[]) {
  const rest = tabs.filter((tab) => !tab.pinned);
  const smart = rest.filter((tab) => tab.name || tab.group);
  const groups = [...new Set(smart.flatMap((tab) => (tab.group ? [tab.group] : [])))];
  return {
    pinned: tabs.filter((tab) => tab.pinned),
    smart: smart.filter((tab) => !tab.group),
    groups: groups.map((name) => ({ name, tabs: smart.filter((tab) => tab.group === name) })),
    adhoc: rest.filter((tab) => !tab.name && !tab.group),
  };
}

// ---- filter builder ---------------------------------------------------------------------------

export type BuilderOp = "=" | "!=" | ">" | ">=" | "<" | "<=";

export interface BuilderRow {
  field: Field;
  op: BuilderOp;
  value: string;
}

export interface Builder {
  /** ALL = AND, ANY = OR over `rows`. */
  join: "all" | "any";
  rows: BuilderRow[];
  /** The one nested OR group. */
  group: BuilderRow[];
  sort: SortKey | null;
  /** Lens parts the rows cannot express; passed through untouched. */
  raw: string[];
}

export const isTextField = (field: Field) => ["text", "exact", "enum"].includes(FIELDS[field]);
export const opsFor = (field: Field): BuilderOp[] => (isTextField(field) ? ["=", "!="] : ["=", "!=", ">", ">=", "<", "<="]);

const rowText = (row: BuilderRow) => {
  const value = quote(row.value.trim());
  return row.op === "!=" ? `!${row.field}:${value}` : `${row.field}:${row.op === "=" ? "" : row.op}${value}`;
};
const filled = (rows: BuilderRow[]) => rows.filter((row) => row.value.trim() !== "").map(rowText);

/** The query the rows describe; canonical when it parses, so it equals typing the same text. */
export function builderText(builder: Builder): string {
  const rows = filled(builder.rows);
  const group = filled(builder.group);
  const parts = builder.join === "any" && rows.length > 1 ? [`(${rows.join(" OR ")})`] : rows;
  if (group.length > 0) parts.push(group.length > 1 ? `(${group.join(" OR ")})` : group[0]);
  parts.push(...builder.raw);
  if (builder.sort) parts.push(formatSort([builder.sort]));
  const text = parts.join(" ");
  return canonical(text);
}

export function toBuilder(query: string): Builder {
  const builder: Builder = { join: "all", rows: [], group: [], sort: null, raw: [] };
  const toRow = (node: Node): BuilderRow | null => {
    if (node.type !== "pred") return null;
    if (node.negated && node.op !== "=") return null;
    return { field: node.field, op: node.negated ? "!=" : node.op, value: node.value };
  };
  const allRows = (nodes: Node[]) => {
    const rows = nodes.map(toRow);
    return rows.every((row) => row !== null) ? (rows as BuilderRow[]) : null;
  };
  let list = items(query);
  // `a OR b` alone is ANY over rows.
  if (list.length === 1 && list[0].type === "or") {
    const rows = allRows(list[0].items);
    if (rows) return { ...builder, join: "any", rows };
  }
  list = list.filter((item) => {
    if (item.type !== "sort" || builder.sort || item.keys.length !== 1) return true;
    builder.sort = item.keys[0];
    return false;
  });
  for (const item of list) {
    const row = toRow(item);
    const group = item.type === "or" && builder.group.length === 0 ? allRows(item.items) : null;
    if (row) builder.rows.push(row);
    else if (group) builder.group = group;
    else builder.raw.push(chips(item)[0].text);
  }
  return builder;
}
