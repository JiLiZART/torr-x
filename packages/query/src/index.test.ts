import assert from "node:assert/strict";
import { test } from "node:test";
import {
  chips,
  compare,
  complete,
  evaluate,
  format,
  formatSort,
  parse,
  sortKeys,
  toggleSort,
  type Node,
  type Row,
} from "./index.ts";

const NOW = 1_800_000_000;
const DAY = 86400;
const GB = 1024 ** 3;

function row(over: Partial<Row> = {}): Row {
  return {
    name: "ubuntu-24.04.iso",
    status: "downloading",
    tags: [],
    tracker: "tracker.a.example",
    size: 5 * GB,
    progress: 0.5,
    ratio: 0.5,
    seeds: 4,
    peers: 2,
    downloadRate: 1024 * 1024,
    uploadRate: 0,
    etaSecs: 600,
    addedAt: NOW - DAY,
    savePath: "/data/downloads",
    ...over,
  };
}

function ast(query: string): Node {
  const result = parse(query);
  assert.equal(result.error, null, `${query}: ${result.error?.message}`);
  return result.ast!;
}

const matches = (query: string, over: Partial<Row> = {}) => evaluate(ast(query), row(over), NOW);

test("empty query matches everything", () => {
  assert.ok(matches(""));
  assert.ok(matches("   "));
});

test("implicit and explicit AND", () => {
  assert.ok(matches("state:active tag:4k", { tags: ["4k"] }));
  assert.ok(!matches("state:active tag:4k", { tags: ["hd"] }));
  assert.ok(!matches("state:active AND tag:4k"));
  assert.equal(format(ast("state:active AND tag:4k")), "state:active tag:4k");
});

test("OR group and both negation forms", () => {
  const query = "size:>4GB (tracker:a.example OR tracker:b.example) state:!paused";
  assert.ok(matches(query));
  assert.ok(matches(query, { tracker: "tracker.b.example" }));
  assert.ok(!matches(query, { tracker: "c.example" }));
  assert.ok(!matches(query, { status: "paused" }));
  assert.ok(!matches(query, { size: GB }));
  assert.ok(matches("!tracker:b.example"));
  assert.ok(matches("ubuntu OR state:paused"));
  assert.ok(!matches("debian OR state:paused"));
});

test("field names and bare values are case-insensitive", () => {
  assert.ok(matches("STATE:Downloading NAME:UBUNTU"));
});

test("quoted phrase, bare word and wildcards", () => {
  assert.ok(!matches('name:"blade runner"', { name: "Blade.Runner.2049" }));
  assert.ok(matches('name:"blade runner"', { name: "blade runner 2049" }));
  assert.ok(matches("ubuntu"));
  assert.ok(!matches("debian"));
  assert.ok(matches("name:ubuntu*iso"));
  assert.ok(!matches("name:*.mkv"));
  assert.ok(matches("tag:4k*", { tags: ["4k-hdr"] }));
  assert.ok(!matches("tag:4k", { tags: ["4k-hdr"] }), "tags match exactly without a wildcard");
});

test("comparisons with units", () => {
  assert.ok(matches("size:>4GB"));
  assert.ok(!matches("size:<=4GB"));
  assert.ok(matches("down:>=1MB/s"));
  assert.ok(matches("up:0"));
  assert.ok(matches("eta:<30m"));
  assert.ok(matches("progress:50%"));
  assert.ok(matches("progress:<75"));
  assert.ok(matches("ratio:<1"));
  assert.ok(!matches("ratio:<1", { ratio: null }), "unknown values never match");
  assert.ok(matches("!ratio:<1", { ratio: null }));
});

test("inclusive ranges", () => {
  assert.ok(matches("size:1GB..5GB"));
  assert.ok(!matches("size:1GB..4GB"));
  assert.ok(matches("ratio:0.5..2"));
  assert.ok(matches("peers:2..2"));
});

test("dates: relative age and ISO", () => {
  assert.ok(matches("added:>7d"), "added within the last seven days");
  assert.ok(!matches("added:>7d", { addedAt: NOW - 8 * DAY }));
  const day = new Date(2025, 0, 15, 12).getTime() / 1000;
  assert.ok(matches("added:2025-01-15", { addedAt: day }));
  assert.ok(matches("added:2025-01-01..2025-01-31", { addedAt: day }));
  assert.ok(matches("added:<2025-02-01", { addedAt: day }));
  assert.ok(!matches("added:>2025-01-15", { addedAt: day }));
});

test("ext matches file rows only", () => {
  assert.ok(matches("ext:mkv size:>1GB", { ext: "mkv" }));
  assert.ok(!matches("ext:mkv", { ext: "srt" }));
  assert.ok(!matches("ext:mkv"), "torrents have no extension");
});

test("fields with no source in the model never match", () => {
  assert.ok(!matches("category:movies"));
  assert.ok(!matches("done:<2025-01-01"));
});

test("derived states", () => {
  assert.ok(matches("state:stalled", { downloadRate: 0, peers: 0, seeds: 0 }));
  assert.ok(!matches("state:stalled", { downloadRate: 2 * 1024 * 1024 }));
  assert.ok(!matches("state:stalled", { status: "seeding", downloadRate: 0 }));
  assert.ok(matches("state:active"));
  assert.ok(matches("state:active", { status: "seeding", downloadRate: 0, uploadRate: 10 }));
  assert.ok(!matches("state:active", { downloadRate: 0 }));
  assert.ok(!matches("state:active", { status: "paused" }));
});

test("parse errors point at the failing token", () => {
  const unknown = parse("statu:active").error;
  assert.deepEqual(unknown, { message: 'unknown field "statu"', column: 0, length: 5, suggestion: "state" });
  assert.deepEqual(parse("tag:4k state:pausd").error, {
    message: 'unknown state "pausd"',
    column: 13,
    length: 5,
    suggestion: "paused",
  });
  assert.equal(parse("size:>abc").error?.column, 6);
  assert.equal(parse("sort:rati").error?.suggestion, "ratio");
  assert.equal(parse("name:>x").error?.message, '"name" does not support >');
  for (const bad of ["(a (b))", "(a", "a)", "a OR", "AND a", "tag:", 'name:"x', "size:1..2..3", "size:>1GB..2GB", "()"]) {
    assert.ok(parse(bad).error, `${bad} must not parse`);
  }
});

test("sort is a predicate: defaults, multi-key, stable ties", () => {
  assert.deepEqual(sortKeys(ast("sort:size")), [{ field: "size", desc: true }]);
  assert.deepEqual(sortKeys(ast("tag:4k sort:name")), [{ field: "name", desc: false }]);
  assert.deepEqual(sortKeys(ast("sort:state desc, size asc")), [
    { field: "state", desc: true },
    { field: "size", desc: false },
  ]);
  assert.ok(matches("sort:ratio desc"));

  const rows = [
    row({ name: "b", size: 1, ratio: 2 }),
    row({ name: "a", size: 1, ratio: null }),
    row({ name: "c", size: 2, ratio: 1 }),
    row({ name: "a2", size: 1, ratio: 2 }),
  ];
  const names = (query: string) => [...rows].sort(compare(sortKeys(ast(query)))).map((r) => r.name);
  assert.deepEqual(names("sort:size"), ["c", "a", "a2", "b"]);
  assert.deepEqual(names("sort:size asc,ratio"), ["a2", "b", "a", "c"], "unknown ratio sorts last");
  assert.deepEqual(names(""), ["a", "a2", "b", "c"]);
});

test("header click equals typing the sort predicate", () => {
  const once = toggleSort([], "size");
  const twice = toggleSort(once, "size");
  assert.equal(formatSort(once), "sort:size desc");
  assert.equal(formatSort(twice), "sort:size asc");
  assert.deepEqual(twice, sortKeys(ast("sort:size asc")));
  assert.deepEqual(toggleSort(twice, "name"), sortKeys(ast("sort:name")));
});

test("format round-trips", () => {
  const queries = [
    "",
    "state:active tag:4k size:>4GB sort:ratio desc",
    "size:>4GB (tracker:a.example OR tracker:b.example) state:!paused",
    'NAME:"blade runner" !tag:x',
    "ubuntu OR debian",
    "a b OR c",
    "x (a OR b c)",
    "x (a b)",
    "added:>7d eta:<30m down:>=1MB/s progress:50%",
    "sort:size, name desc",
    'name:"simple"',
    "size:1gb..4GB",
  ];
  for (const query of queries) {
    const once = format(ast(query));
    assert.equal(format(ast(once)), once, query);
  }
  assert.equal(format(ast("state:!paused")), "!state:paused");
  assert.equal(format(ast("ubuntu")), "name:*ubuntu*");
  assert.equal(format(ast("sort:size")), "sort:size desc");
  assert.equal(format(ast("x (a b)")), "name:*x* name:*a* name:*b*");
});

test("chips: one per top-level predicate, sort distinct", () => {
  const list = chips(ast("state:active !tag:4k size:>4GB (tracker:a OR tracker:b) sort:ratio desc"));
  assert.deepEqual(
    list.map((c) => [c.key, c.value, c.kind, c.negated]),
    [
      ["state", "active", "filter", false],
      ["tag", "4k", "filter", true],
      ["size", ">4GB", "filter", false],
      ["", "(tracker:a OR tracker:b)", "group", false],
      ["sort", "ratio desc", "sort", false],
    ],
  );
  assert.equal(format(ast(list.map((c) => c.text).join(" "))), format(ast("state:active !tag:4k size:>4GB (tracker:a OR tracker:b) sort:ratio desc")));
  assert.equal(chips(ast("a OR b")).length, 1);
  assert.deepEqual(chips(ast("")), []);
});

test("completion", () => {
  const options = (input: string, values = {}) => complete(input, input.length, values).options;
  assert.deepEqual(options("st"), ["state:"]);
  assert.deepEqual(options("tag:4k s"), ["state:", "size:", "seeds:", "sort:"]);
  assert.deepEqual(options("state:"), ["downloading", "seeding", "paused", "checking", "queued", "error", "active", "stalled"]);
  assert.deepEqual(options("state:!s"), ["seeding", "stalled"]);
  assert.deepEqual(options("size:"), [">", "<", ">=", "<="]);
  assert.deepEqual(options("tag:4", { tag: ["4k", "movies"] }), ["4k"]);
  assert.deepEqual(options("sort:ra"), ["ratio"]);
  assert.deepEqual(options("sort:size desc,n"), ["name"]);
  assert.deepEqual(options("sort:ratio d"), ["desc"]);
  assert.deepEqual(options("sort:ratio st"), ["state:"]);
  assert.deepEqual(options("bogus:"), []);
  assert.deepEqual(complete("state:pa tag:4k", 8), { from: 6, to: 8, options: ["paused"] });
});
