import assert from "node:assert/strict";
import { test } from "node:test";
import type { Torrent } from "@torrentx/api-client";
import { graphPaths, MAX_SAMPLES, pushSample, type History } from "./activity.ts";

const tor = (id: string, status: string, progress: number, down = 0, up = 0) =>
  ({ id, status, progress, size: 1000, downloadRate: down, uploadRate: up }) as unknown as Torrent;

test("disk rate is derived from completed bytes", () => {
  let h: History = new Map();
  h = pushSample(h, [tor("a", "downloading", 0.1, 50)], 0);
  h = pushSample(h, [tor("a", "downloading", 0.3, 50)], 2000);
  const s = h.get("a")!;
  assert.equal(s[0].disk, 0);
  assert.equal(s[1].disk, 100); // 200 bytes over 2 s
  assert.equal(s[1].down, 50);
});

test("inactive and removed torrents are dropped", () => {
  let h = pushSample(new Map(), [tor("a", "downloading", 0), tor("b", "seeding", 1)], 0);
  h = pushSample(h, [tor("a", "paused", 0)], 1500);
  assert.deepEqual([...h.keys()], []);
});

test("history is capped and restarts after a gap", () => {
  let h: History = new Map();
  for (let i = 0; i < MAX_SAMPLES + 5; i++) h = pushSample(h, [tor("a", "downloading", 0)], i * 1500);
  assert.equal(h.get("a")!.length, MAX_SAMPLES);
  h = pushSample(h, [tor("a", "downloading", 0)], 1e9);
  assert.equal(h.get("a")!.length, 1);
});

test("graph is scaled to the row peak and survives all-zero samples", () => {
  let h = pushSample(new Map(), [tor("a", "downloading", 0, 0, 0)], 0);
  h = pushSample(h, [tor("a", "downloading", 0, 0, 0)], 1500);
  assert.ok(!graphPaths(h.get("a")!).up.includes("NaN"));
  h = pushSample(h, [tor("a", "downloading", 0, 200, 100)], 3000);
  const p = graphPaths(h.get("a")!);
  assert.ok(p.down.endsWith("L100.00 10.00 L100 100 Z"), p.down);
  assert.ok(p.up.endsWith("L100.00 55.00"), p.up);
});
