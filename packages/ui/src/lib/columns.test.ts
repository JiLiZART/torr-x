import assert from "node:assert/strict";
import { test } from "node:test";
import { COLUMN_ORDER, columnOrder, columnWidths, dropIndex, MIN_COLUMN, moveColumn, resizeTarget } from "./columns.ts";

test("columnOrder repairs a saved order", () => {
  assert.deepEqual(columnOrder(null), COLUMN_ORDER);
  const saved = columnOrder(["tracker", "nope", "name", "tracker"]);
  assert.deepEqual(saved.slice(0, 2), ["tracker", "name"]);
  assert.equal(saved.length, COLUMN_ORDER.length);
  assert.equal(new Set(saved).size, COLUMN_ORDER.length);
});

test("moveColumn moves one column and keeps the rest in order", () => {
  assert.deepEqual(moveColumn(["name", "size", "progress"], 2, 0), ["progress", "name", "size"]);
  assert.deepEqual(moveColumn(["name", "size", "progress"], 0, 9), ["size", "progress", "name"]);
});

test("columnWidths keeps known fixed columns, clamped", () => {
  assert.deepEqual(columnWidths({ size: 10, tracker: 120.4, name: 300, nope: 50, peers: "x" }), { size: MIN_COLUMN, tracker: 120 });
  assert.deepEqual(columnWidths(null), {});
});

test("resizeTarget: a border resizes its left column, or the neighbour of name", () => {
  assert.deepEqual(resizeTarget(["name", "size"], "size"), { column: "size", sign: 1 });
  assert.deepEqual(resizeTarget(["name", "size"], "name"), { column: "size", sign: -1 });
  assert.equal(resizeTarget(["size", "name"], "name"), null);
});

test("dropIndex: gaps after the dragged column land one earlier", () => {
  assert.equal(dropIndex(2, 0), 0);
  assert.equal(dropIndex(2, 2), 2, "its own gap: no move");
  assert.equal(dropIndex(2, 3), 2, "the gap right after it: no move");
  assert.equal(dropIndex(0, 10), 9, "after the last of ten");
});
