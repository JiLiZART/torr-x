import assert from "node:assert/strict";
import { test } from "node:test";
import { bytes, rate } from "./format.ts";

test("rate has a constant width", () => {
  const samples = [0, 1, 512, 999, 1000, 1023, 1024, 757.2 * 1024, 999.96 * 1024, 1024 * 1024, 5.4e8, 3e12];
  for (const n of samples) assert.equal(rate(n).length, 10, `${n} → "${rate(n)}"`);
  assert.equal(rate(757.2 * 1024).replace(/\u00a0/g, " "), "757.2 KB/s");
  assert.equal(rate(1024 * 1024).replace(/\u00a0/g, " "), "  1.0 MB/s");
  assert.equal(rate(1000).replace(/\u00a0/g, " "), "  1.0 KB/s");
  assert.equal(rate(0).trim(), "-");
  assert.ok(!rate(757.2 * 1024).includes(" "), "no breakable space");
});

test("bytes never breaks between number and unit", () => {
  assert.equal(bytes(1023.5 * 1024 * 1024), "1023.5\u00a0MB");
  assert.equal(bytes(512), "512\u00a0B");
});
