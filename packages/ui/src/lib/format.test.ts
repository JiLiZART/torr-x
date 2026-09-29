import assert from "node:assert/strict";
import { test } from "node:test";
import { rate } from "./format.ts";

test("rate has a constant width", () => {
  const samples = [0, 1, 512, 999, 1000, 1023, 1024, 757.2 * 1024, 999.96 * 1024, 1024 * 1024, 5.4e8, 3e12];
  for (const n of samples) assert.equal(rate(n).length, 10, `${n} → "${rate(n)}"`);
  assert.equal(rate(757.2 * 1024).replace(/\u00a0/g, " "), "757.2 KB/s");
  assert.equal(rate(1024 * 1024).replace(/\u00a0/g, " "), "  1.0 MB/s");
  assert.equal(rate(1000).replace(/\u00a0/g, " "), "  1.0 KB/s");
  assert.equal(rate(0).trim(), "-");
});
