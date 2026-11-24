import assert from "node:assert/strict";
import { test } from "node:test";
import { chips, parse, sortKeys, type Row } from "@torrentx/query";
import {
  addChips,
  blame,
  builderText,
  clickSort,
  combine,
  fuzzyNode,
  hasLens,
  moveChip,
  negateChip,
  predicateCount,
  removeChip,
  sections,
  toBuilder,
} from "./lens.ts";

const GB = 1024 ** 3;
const row = (over: Partial<Row>): Row => ({
  name: "ubuntu.iso",
  status: "downloading",
  tags: [],
  tracker: "a.example",
  size: 5 * GB,
  progress: 0.5,
  ratio: 1,
  seeds: 1,
  peers: 1,
  downloadRate: 10,
  uploadRate: 0,
  etaSecs: 60,
  addedAt: 0,
  savePath: "/dl",
  ...over,
});
const ast = (query: string) => parse(query).ast!;
const LENS = "state:active tag:4k size:>4GB sort:ratio desc";

test("funnel count excludes sort and the fuzzy input", () => {
  assert.equal(predicateCount(LENS), 3);
  assert.equal(predicateCount(""), 0);
  assert.ok(hasLens({ fuzzy: "ubuntu", query: "" }));
  assert.ok(!hasLens({ fuzzy: " ", query: "" }));
});

test("chip edits keep the lens canonical", () => {
  assert.equal(removeChip(LENS, 1), "state:active size:>4GB sort:ratio desc");
  assert.equal(negateChip(LENS, 1), "state:active !tag:4k size:>4GB sort:ratio desc");
  assert.equal(negateChip(negateChip(LENS, 1), 1), LENS);
  assert.equal(negateChip(LENS, 3), LENS, "sort cannot be negated");
  assert.equal(moveChip(LENS, 0, 2), "tag:4k size:>4GB state:active sort:ratio desc");
  assert.equal(addChips("a OR b", "tag:x"), "(name:*a* OR name:*b*) tag:x");
  assert.equal(addChips("", "tag:x"), "tag:x");
});

test("header click equals typing the sort chip", () => {
  const once = clickSort("tag:4k", [], "size");
  const twice = clickSort(once, [], "size");
  assert.equal(once, "tag:4k sort:size desc");
  assert.equal(twice, "tag:4k sort:size asc");
  assert.deepEqual(chips(ast(twice)), chips(ast("tag:4k sort:size asc")));
  // Starts from the tab's order when the lens has none.
  assert.equal(clickSort("", sortKeys(ast("sort:added desc")), "added"), "sort:added asc");
});

test("save as tab stores tab query AND lens", () => {
  const lens = { fuzzy: "ubuntu", query: "tag:4k sort:size asc" };
  assert.equal(combine(ast("state:active sort:added desc"), lens), "state:active name:*ubuntu* tag:4k sort:size asc");
  assert.equal(combine(ast("a OR b"), { fuzzy: "", query: "tag:x" }), "(name:*a* OR name:*b*) tag:x");
  assert.equal(combine(ast(""), { fuzzy: "", query: "tag:x" }), "tag:x");
  assert.equal(combine(ast("state:active sort:added desc"), { fuzzy: "", query: "tag:x" }), "state:active tag:x sort:added desc");
});

test("zero results name the responsible predicate", () => {
  const rows = [row({}), row({ name: "debian.iso", size: GB })];
  assert.deepEqual(blame(rows, ast(""), null, ast("state:downloading size:>100GB")), {
    source: "lens",
    text: "size:>100GB",
    index: 1,
  });
  assert.equal(blame(rows, ast("tag:none"), null, ast("size:>1GB"))?.source, "tab");
  assert.equal(blame(rows, ast(""), fuzzyNode("fedora"), null)?.source, "fuzzy");
  assert.equal(blame(rows, ast(""), null, ast("size:>1GB")), null);
});

test("sidebar sections are derived", () => {
  const tab = (name: string, query: string, pinned = false, group: string | null = null) => ({ name, query, pinned, group });
  const s = sections([
    tab("All", "", true),
    tab("Active", "state:active"),
    tab("4K Movies", "tag:4k", false, "Media"),
    tab("", "tracker:xyz"),
    tab("Shows", "tag:shows", false, "Media"),
  ]);
  assert.deepEqual(s.pinned.map((t) => t.name), ["All"]);
  assert.deepEqual(s.smart.map((t) => t.name), ["Active"]);
  assert.deepEqual(s.groups.map((g) => [g.name, g.tabs.length]), [["Media", 2]]);
  assert.deepEqual(s.adhoc.map((t) => t.query), ["tracker:xyz"]);
});

test("builder and text agree", () => {
  assert.equal(builderText(toBuilder(LENS)), LENS);
  assert.deepEqual(chips(ast(builderText(toBuilder(LENS)))), chips(ast(LENS)));

  const grouped = toBuilder("size:>4GB (tracker:a.example OR tracker:b.example)");
  assert.equal(grouped.group.length, 2);
  assert.equal(builderText(grouped), "size:>4GB (tracker:a.example OR tracker:b.example)");

  const any = toBuilder("tracker:a.example OR tracker:b.example");
  assert.equal(any.join, "any");
  assert.equal(builderText(any), "tracker:a.example OR tracker:b.example");

  const built = builderText({
    join: "all",
    rows: [
      { field: "state", op: "!=", value: "paused" },
      { field: "name", op: "=", value: "blade runner" },
      { field: "ratio", op: ">=", value: "" },
    ],
    group: [],
    sort: { field: "size", desc: false },
    raw: [],
  });
  assert.equal(built, '!state:paused name:"blade runner" sort:size asc');

  // What rows cannot express survives untouched.
  const odd = "!size:>4GB (tag:a OR tag:b c) sort:size desc,name asc";
  assert.equal(builderText(toBuilder(odd)), parse(odd).ast && builderText(toBuilder(builderText(toBuilder(odd)))));
  assert.equal(toBuilder(odd).rows.length, 0);
});
