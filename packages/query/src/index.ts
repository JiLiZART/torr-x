// @torrentx/query: the one query language shared by tabs, the lens, the filter bar, the palette and the
// terminal. Pure TS, no runtime deps. Text is the stored form; the AST is never serialized.

/** Stored next to tab queries so a later grammar can migrate them. */
export const GRAMMAR_VERSION = 1;

type Kind = "text" | "exact" | "enum" | "size" | "speed" | "number" | "percent" | "duration" | "date";

export const FIELDS = {
  name: "text",
  state: "enum",
  tag: "exact",
  category: "exact",
  tracker: "text",
  size: "size",
  progress: "percent",
  ratio: "number",
  seeds: "number",
  peers: "number",
  down: "speed",
  up: "speed",
  eta: "duration",
  added: "date",
  done: "date",
  path: "text",
} as const satisfies Record<string, Kind>;

export type Field = keyof typeof FIELDS;
export const FIELD_NAMES = Object.keys(FIELDS) as Field[];

/** Engine statuses plus the derived `active` and `stalled`. */
export const STATES = ["downloading", "seeding", "paused", "checking", "queued", "error", "active", "stalled"] as const;

/** The part of a torrent the language reads; `Torrent` from the API client satisfies it. */
export interface Row {
  name: string;
  status: string;
  tags: string[];
  tracker: string | null;
  size: number;
  /** 0..1 */
  progress: number;
  ratio: number | null;
  seeds: number;
  peers: number;
  downloadRate: number;
  uploadRate: number;
  etaSecs: number | null;
  /** Unix seconds. */
  addedAt: number;
  savePath: string;
}

export type Op = "=" | ">" | "<" | ">=" | "<=";

export interface Pred {
  type: "pred";
  field: Field;
  negated: boolean;
  op: Op;
  /** Without quotes; `a..b` for a range. */
  value: string;
  column: number;
  length: number;
  /** Compiled at parse time; ignores `negated`. */
  test: (row: Row, now: number) => boolean;
}

export interface SortKey {
  field: Field;
  desc: boolean;
}

export interface Sort {
  type: "sort";
  keys: SortKey[];
  column: number;
  length: number;
}

export interface Group {
  type: "and" | "or";
  items: Node[];
}

export type Node = Pred | Sort | Group;

export interface ParseError {
  message: string;
  /** 0-based offset of the failing token. */
  column: number;
  length: number;
  suggestion: string | null;
}

export type ParseResult = { ast: Node; error: null } | { ast: null; error: ParseError };

class Fail extends Error {
  error: ParseError;
  constructor(error: ParseError) {
    super(error.message);
    this.error = error;
  }
}

const isText = (kind: Kind) => kind === "text" || kind === "exact" || kind === "enum";

/** Numeric, size, speed and date keys sort descending by default; text keys ascending. */
export const defaultDesc = (field: Field) => !isText(FIELDS[field]);

function read(field: Field, row: Row): string | number | string[] | null {
  switch (field) {
    case "name":
      return row.name;
    case "state":
      return row.status;
    case "tag":
      return row.tags;
    case "tracker":
      return row.tracker;
    case "size":
      return row.size;
    case "progress":
      return Math.round(row.progress * 1000) / 10;
    case "ratio":
      return row.ratio;
    case "seeds":
      return row.seeds;
    case "peers":
      return row.peers;
    case "down":
      return row.downloadRate;
    case "up":
      return row.uploadRate;
    case "eta":
      return row.etaSecs;
    case "added":
      return row.addedAt;
    case "path":
      return row.savePath;
    // shortcut: the model has no category or completion date, so these never match; read them here once it does.
    case "category":
    case "done":
      return null;
  }
}

function isState(row: Row, state: string): boolean {
  const moving = row.downloadRate > 0 || row.uploadRate > 0;
  if (state === "active") return (row.status === "downloading" || row.status === "seeding") && moving;
  if (state === "stalled") {
    return row.status === "downloading" && (row.downloadRate === 0 || row.peers + row.seeds === 0);
  }
  return row.status === state;
}

function levenshtein(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function nearest(word: string, candidates: readonly string[]): string | null {
  let best: string | null = null;
  let bestDistance = 3;
  for (const c of candidates) {
    const d = levenshtein(word, c);
    if (d < bestDistance) [best, bestDistance] = [c, d];
  }
  return best;
}

/** A value as an inclusive interval; `age` means "that long before now" (dates only). */
interface Bound {
  lo: number;
  hi: number;
  age: boolean;
}

const SIZE: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3, tb: 1024 ** 4 };
const TIME: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

function bound(kind: Kind, text: string): Bound | null {
  const point = (n: number, age = false): Bound => ({ lo: n, hi: n, age });
  let m: RegExpExecArray | null;
  switch (kind) {
    case "size":
    case "speed":
      m = /^(\d+(?:\.\d+)?)(b|kb|mb|gb|tb)?(\/s)?$/i.exec(text);
      if (!m || (m[3] && kind === "size")) return null;
      return point(+m[1] * SIZE[(m[2] ?? "b").toLowerCase()]);
    case "number":
    case "percent":
      m = /^(\d+(?:\.\d+)?)(%)?$/.exec(text);
      if (!m || (m[2] && kind === "number")) return null;
      return point(+m[1]);
    case "duration":
      m = /^(\d+(?:\.\d+)?)(s|m|h|d)?$/i.exec(text);
      return m && point(+m[1] * TIME[(m[2] ?? "s").toLowerCase()]);
    case "date": {
      m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      if (m) {
        const lo = new Date(+m[1], +m[2] - 1, +m[3]).getTime() / 1000;
        return { lo, hi: lo + 86399, age: false };
      }
      m = /^(\d+(?:\.\d+)?)(s|m|h|d)$/i.exec(text);
      return m && point(+m[1] * TIME[m[2].toLowerCase()], true);
    }
    default:
      return null;
  }
}

function numericTest(field: Field, op: Op, a: Bound, b: Bound): Pred["test"] {
  return (row, now) => {
    const v = read(field, row);
    if (typeof v !== "number") return false;
    let lo = a.age ? now - a.lo : a.lo;
    let hi = b.age ? now - b.lo : b.hi;
    if (lo > hi) [lo, hi] = [hi, lo];
    switch (op) {
      case ">":
        return v > hi;
      case ">=":
        return v >= lo;
      case "<":
        return v < lo;
      case "<=":
        return v <= hi;
      default:
        return v >= lo && v <= hi;
    }
  };
}

function textTest(field: Field, value: string): Pred["test"] {
  const needle = value.toLowerCase();
  if (field === "state") return (row) => isState(row, needle);
  let match: (s: string) => boolean;
  if (needle.includes("*")) {
    const glob = needle.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"));
    const re = new RegExp(`^${glob.join(".*")}$`, "s");
    match = (s) => re.test(s);
  } else if (FIELDS[field] === "text") {
    match = (s) => s.includes(needle);
  } else {
    match = (s) => s === needle;
  }
  return (row) => {
    const v = read(field, row);
    if (v === null || typeof v === "number") return false;
    return (Array.isArray(v) ? v : [v]).some((s) => match(s.toLowerCase()));
  };
}

/** Parses query text. An empty query matches everything. Never throws. */
export function parse(input: string): ParseResult {
  let i = 0;
  const fail = (message: string, column: number, length: number, suggestion: string | null = null): never => {
    throw new Fail({ message, column, length: Math.max(length, 1), suggestion });
  };
  // `re` must be sticky.
  const eat = (re: RegExp) => {
    re.lastIndex = i;
    const m = re.exec(input);
    if (m) i += m[0].length;
    return m;
  };
  const skipSpace = () => eat(/\s*/y);
  const keyword = (word: "AND" | "OR") => eat(new RegExp(`${word}(?=[\\s(]|$)`, "y"));

  function sort(start: number): Sort {
    const keys: SortKey[] = [];
    do {
      const keyStart = i;
      const m = eat(/[A-Za-z]+/y);
      if (!m) return fail("missing sort key", start, i - start);
      const field = m[0].toLowerCase();
      if (!(field in FIELDS)) {
        return fail(`unknown sort key "${m[0]}"`, keyStart, m[0].length, nearest(field, FIELD_NAMES));
      }
      const dir = eat(/\s+(asc|desc)(?=[\s,)]|$)/iy);
      keys.push({
        field: field as Field,
        desc: dir ? dir[1].toLowerCase() === "desc" : defaultDesc(field as Field),
      });
    } while (eat(/\s*,\s*/y));
    return { type: "sort", keys, column: start, length: i - start };
  }

  function term(depth: number): Node {
    const start = i;
    if (input[i] === "(") {
      if (depth > 0) fail("only one level of parentheses is supported", i, 1);
      i++;
      const node = or(depth + 1);
      skipSpace();
      if (input[i] !== ")") fail("missing closing parenthesis", start, 1);
      i++;
      return node;
    }
    if (input[i] === ")") fail("unexpected closing parenthesis", i, 1);

    let negated = !!eat(/!/y);
    const nameStart = i;
    const named = eat(/([A-Za-z]+):/y);
    const field = named ? named[1].toLowerCase() : "name";
    if (field === "sort") {
      if (negated) fail("sort cannot be negated", start, 1);
      return sort(start);
    }
    if (named && !(field in FIELDS)) {
      fail(`unknown field "${named[1]}"`, nameStart, named[1].length, nearest(field, [...FIELD_NAMES, "sort"]));
    }
    const kind = FIELDS[field as Field];
    if (named && eat(/!/y)) negated = !negated;
    const op = (named ? eat(/>=|<=|>|</y)?.[0] : undefined) ?? "=";

    const valueStart = i;
    let value: string;
    if (input[i] === '"') {
      const quoted = eat(/"([^"]*)"/y);
      if (!quoted) return fail("missing closing quote", valueStart, input.length - valueStart);
      value = quoted[1];
    } else {
      value = eat(/[^\s()]*/y)![0];
    }
    if (value === "") fail(`missing value for "${field}"`, start, i - start);
    // A bare word is a name search.
    if (!named && !value.includes("*")) value = `*${value}*`;
    const valueLength = i - valueStart;

    let test: Pred["test"];
    if (isText(kind)) {
      if (op !== "=") fail(`"${field}" does not support ${op}`, nameStart, i - nameStart);
      if (kind === "enum") {
        value = value.toLowerCase();
        if (!(STATES as readonly string[]).includes(value)) {
          fail(`unknown state "${value}"`, valueStart, valueLength, nearest(value, STATES));
        }
      }
      test = textTest(field as Field, value);
    } else {
      const [from, to, ...rest] = value.split("..");
      const a = bound(kind, from);
      const b = to === undefined ? a : bound(kind, to);
      if (!a || !b || rest.length > 0 || (to !== undefined && op !== "=")) {
        return fail(`invalid ${kind} "${value}"`, valueStart, valueLength);
      }
      test = numericTest(field as Field, op as Op, a, b);
    }
    return { type: "pred", field: field as Field, negated, op: op as Op, value, column: start, length: i - start, test };
  }

  function and(depth: number): Node {
    const items: Node[] = [];
    for (;;) {
      skipSpace();
      const at = i;
      if (keyword("AND")) {
        skipSpace();
        if (items.length === 0 || i >= input.length || input[i] === ")") fail("expected a predicate", at, 3);
        continue;
      }
      if (i >= input.length || input[i] === ")" || /^OR(?=[\s(]|$)/.test(input.slice(i))) break;
      const node = term(depth);
      if (node.type === "and") items.push(...node.items);
      else items.push(node);
    }
    if (items.length === 0) fail("expected a predicate", Math.min(i, Math.max(input.length - 1, 0)), 1);
    return items.length === 1 ? items[0] : { type: "and", items };
  }

  function or(depth: number): Node {
    const items: Node[] = [];
    do {
      const node = and(depth);
      if (node.type === "or") items.push(...node.items);
      else items.push(node);
      skipSpace();
    } while (keyword("OR"));
    return items.length === 1 ? items[0] : { type: "or", items };
  }

  if (input.trim() === "") return { ast: { type: "and", items: [] }, error: null };
  try {
    const ast = or(0);
    if (i < input.length) fail("unexpected closing parenthesis", i, 1);
    return { ast, error: null };
  } catch (e) {
    if (e instanceof Fail) return { ast: null, error: e.error };
    throw e;
  }
}

/** True when the torrent matches; `sort:` always matches. `now` is unix seconds. */
export function evaluate(node: Node, row: Row, now = Date.now() / 1000): boolean {
  switch (node.type) {
    case "pred":
      return node.negated !== node.test(row, now);
    case "sort":
      return true;
    case "and":
      return node.items.every((item) => evaluate(item, row, now));
    case "or":
      return node.items.some((item) => evaluate(item, row, now));
  }
}

/** Every `sort:` key of the query, left to right. */
export function sortKeys(node: Node): SortKey[] {
  if (node.type === "sort") return node.keys;
  if (node.type === "pred") return [];
  return node.items.flatMap(sortKeys);
}

/** Comparator for the keys, left to right; unknown values last; ties break by name. */
export function compare(keys: SortKey[]): (a: Row, b: Row) => number {
  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name);
  return (a, b) => {
    for (const { field, desc } of keys) {
      const [x, y] = [read(field, a), read(field, b)].map((v) => (Array.isArray(v) ? v.join(",") : v));
      if (x === y) continue;
      if (x === null) return 1;
      if (y === null) return -1;
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      if (order !== 0) return desc ? -order : order;
    }
    return byName(a, b);
  };
}

/** What a column header click does: flip the leading key, or make the field the only key. */
export function toggleSort(keys: SortKey[], field: Field): SortKey[] {
  if (keys[0]?.field === field) return [{ field, desc: !keys[0].desc }, ...keys.slice(1)];
  return [{ field, desc: defaultDesc(field) }];
}

export function formatSort(keys: SortKey[]): string {
  return `sort:${keys.map((k) => `${k.field} ${k.desc ? "desc" : "asc"}`).join(",")}`;
}

/** Canonical text: `format(parse(format(x)))` equals `format(x)`. */
export function format(node: Node): string {
  switch (node.type) {
    case "pred": {
      const value = /[\s()]/.test(node.value) ? `"${node.value}"` : node.value;
      return `${node.negated ? "!" : ""}${node.field}:${node.op === "=" ? "" : node.op}${value}`;
    }
    case "sort":
      return formatSort(node.keys);
    case "and":
      return node.items.map((item) => (item.type === "or" ? `(${format(item)})` : format(item))).join(" ");
    case "or":
      return node.items.map(format).join(" OR ");
  }
}

/** The top-level predicates of a query: what the chip row shows and edits. */
export function topItems(node: Node): Node[] {
  return node.type === "and" ? node.items : [node];
}

export interface Chip {
  /** Field name, `sort`, or `""` for a group. */
  key: string;
  value: string;
  kind: "filter" | "sort" | "group";
  negated: boolean;
  /** Canonical text of this chip alone. */
  text: string;
}

export function chips(node: Node): Chip[] {
  return topItems(node).map((item) => {
    const text = item.type === "or" || item.type === "and" ? `(${format(item)})` : format(item);
    if (item.type === "pred") {
      const value = text.slice(text.indexOf(":") + 1);
      return { key: item.field, value, kind: "filter", negated: item.negated, text };
    }
    if (item.type === "sort") return { key: "sort", value: text.slice(5), kind: "sort", negated: false, text };
    return { key: "", value: text, kind: "group", negated: false, text };
  });
}

export interface Completion {
  /** Replace `input.slice(from, to)` with the chosen option. */
  from: number;
  to: number;
  options: string[];
}

/**
 * One completion source for every surface: field names for a bare word, operators or values after
 * `field:`, keys and directions after `sort:`. `values` supplies live values (tags, trackers).
 */
export function complete(
  input: string,
  caret: number,
  values: Partial<Record<Field, string[]>> = {},
): Completion {
  const head = input.slice(0, caret);
  const pick = (pool: readonly string[], partial: string): Completion => ({
    from: caret - partial.length,
    to: caret,
    options: pool.filter((option) => option.startsWith(partial.toLowerCase())),
  });

  const sorting = /(?:^|[\s(])sort:([a-z, ]*)$/i.exec(head);
  if (sorting) {
    const segment = sorting[1].slice(sorting[1].lastIndexOf(",") + 1).trimStart();
    const dir = /^([a-z]+)\s+([a-z]*)$/i.exec(segment);
    if (dir && dir[1].toLowerCase() in FIELDS) {
      const found = pick(["asc", "desc"], dir[2]);
      if (found.options.length > 0) return found;
    } else if (/^[a-z]*$/i.test(segment)) {
      return pick(FIELD_NAMES, segment);
    }
  }

  const token = /[^\s()]*$/.exec(head)![0];
  const colon = token.indexOf(":");
  if (colon < 0) {
    const found = pick([...FIELD_NAMES, "sort"], token.replace(/^!/, ""));
    return { ...found, options: found.options.map((name) => `${name}:`) };
  }
  const field = token.slice(0, colon).replace(/^!/, "").toLowerCase();
  if (!(field in FIELDS)) return { from: caret, to: caret, options: [] };
  const rest = token.slice(colon + 1);
  const partial = rest.replace(/^!?(>=|<=|>|<)?/, "");
  if (field === "state") return pick(STATES, partial);
  const live = values[field as Field];
  if (live) return pick(live, partial);
  if (!isText(FIELDS[field as Field]) && rest === "") return pick([">", "<", ">=", "<="], "");
  return { from: caret, to: caret, options: [] };
}
