import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileHit } from "@torrentx/api-client";
import { parse } from "@torrentx/query";
import { detectMode, draftCompletion, fileJumps, queryWords, suggestTabName, tokenSpans } from "./palette.ts";

const ast = (text: string) => {
  const { ast } = parse(text);
  assert.ok(ast, text);
  return ast;
};

test("tokenSpans splits field and value and keeps the rest plain", () => {
  assert.deepEqual(tokenSpans("state:active tag:4k"), [
    { text: "state:", kind: "field" },
    { text: "active", kind: "value" },
    { text: " ", kind: "plain" },
    { text: "tag:", kind: "field" },
    { text: "4k", kind: "value" },
  ]);
});

test("tokenSpans: bare words, trailing spaces, negation and quotes", () => {
  assert.deepEqual(tokenSpans("ubuntu !tag:iso "), [
    { text: "ubuntu ", kind: "plain" },
    { text: "!tag:", kind: "field" },
    { text: "iso", kind: "value" },
    { text: " ", kind: "plain" },
  ]);
  assert.deepEqual(tokenSpans('name:"the bear"'), [
    { text: "name:", kind: "field" },
    { text: '"the bear"', kind: "value" },
  ]);
});

test("tokenSpans: a partial or invalid input is plain and keeps every character", () => {
  for (const text of ["state:", "tag:4k (size:>1GB", "foo bar"]) {
    const spans = tokenSpans(text);
    assert.equal(spans.map((s) => s.text).join(""), text);
    assert.ok(spans.every((s) => s.kind === "plain"), text);
  }
});

test("tokenSpans: sort is a token", () => {
  assert.deepEqual(tokenSpans("sort:ratio desc"), [
    { text: "sort:", kind: "field" },
    { text: "ratio desc", kind: "value" },
  ]);
});

test("suggestTabName keeps plain field:value values only", () => {
  const text = "state:active tag:4k size:>4GB sort:ratio";
  assert.equal(suggestTabName(text, ast(text)), "active · 4k");
  assert.equal(suggestTabName("ubuntu !tag:iso size:1GB..2GB", ast("ubuntu !tag:iso size:1GB..2GB")), "");
  assert.equal(suggestTabName("state:paused", ast("state:paused")), "paused");
});

test("queryWords: values and sort keys, short and negated dropped", () => {
  assert.deepEqual(queryWords(ast("state:active tag:4k size:>4GB sort:ratio !tag:x ubuntu")), ["active", "4k", "4gb", "ratio", "ubuntu"]);
});

const hit = (path: string, torrentName = "T"): FileHit => ({
  torrentId: "a".repeat(40),
  torrentName,
  index: 0,
  path,
  size: 1,
  progress: 0,
  wanted: true,
  priority: "normal",
});

test("fileJumps ranks by score and respects the limit", () => {
  const hits = [hit("docs/my-ratio.txt"), hit("Severance/ratio-watchlist.txt", "Severance"), hit("readme.md"), hit("x/ratios.csv")];
  const found = fileJumps(hits, ["ratio"], 2);
  assert.deepEqual(
    found.map((f) => [f.name, f.torrentName]),
    [
      ["ratio-watchlist.txt", "Severance"],
      ["ratios.csv", "T"],
    ],
  );
  assert.deepEqual(fileJumps(hits, [], 3), []);
});

test("`:field value` prefix form: fields after `:`, values after the space, text never rewritten", () => {
  assert.equal(detectMode(":").kind, "draft");
  assert.equal(detectMode("state:active :si").kind, "draft");
  assert.equal(detectMode(":size ").kind, "draft");
  assert.equal(detectMode(":size >4GB").kind, "query");
  assert.equal(detectMode(":nope x").kind, "jump", "an unknown field stays a word");
  const all = draftCompletion(":", {});
  assert.equal(all.from, 1);
  assert.ok(all.options.includes("size ") && all.options.includes("sort "));
  assert.deepEqual(draftCompletion("state:active !:ta", {}), { from: 15, options: ["tag "] });
  assert.deepEqual(draftCompletion(":size ", {}), { from: 6, options: [">", "<", ">=", "<="] });
  assert.deepEqual(draftCompletion("size:", {}).options, [">", "<", ">=", "<="]);
  assert.deepEqual(tokenSpans(":size >4GB").map((s) => [s.text, s.kind]), [[":size ", "field"], [">4GB", "value"]]);
});
