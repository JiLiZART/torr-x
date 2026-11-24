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

test("trimMiddle keeps the start and the end that matters", async () => {
  const { trimMiddle } = await import("./format.ts");
  const scene = "The.Expanse.S01E04.CQB.1080p.BluRay.x264-DEMAND.Extended.Cut.Remastered.mkv";
  const cut = trimMiddle(scene, 44);
  assert.equal(cut.length, 44);
  assert.ok(cut.startsWith("The.Expanse.S01E04"), cut);
  assert.ok(cut.endsWith("…Remastered.mkv") || cut.endsWith(".mkv"), cut);
  assert.equal(cut.split("…").length, 2);
  // An episode code near the end survives the cut.
  const late = "Some.Very.Long.Show.Name.With.Extra.Words.Season.Pack.S02E11.mkv";
  assert.ok(trimMiddle(late, 30).endsWith("S02E11.mkv"), trimMiddle(late, 30));
  assert.equal(trimMiddle(late, 30).length, 30);
  // No extension: plain middle cut.
  const bare = "a".repeat(30) + "README";
  assert.equal(trimMiddle(bare, 20), `${"a".repeat(19)}…`);
  assert.equal(trimMiddle("short.iso", 44), "short.iso");
});
