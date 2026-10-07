import { test } from "node:test";
import assert from "node:assert/strict";
import type { Stats, Torrent } from "@torrentx/api-client";
import { run, type TerminalDeps } from "./terminal.ts";
import { isNewer, pieceCells } from "./format.ts";

const torrents = [
  { id: "abc123", name: "ubuntu.iso", status: "downloading", progress: 0.5 },
  { id: "abd456", name: "debian.iso", status: "seeding", progress: 1 },
] as Torrent[];

function deps() {
  const calls: string[] = [];
  const d: TerminalDeps = {
    list: async () => torrents,
    stats: async () => ({ downloadRate: 2048, uploadRate: 0, active: 1, torrents: 2, ratio: 1.5 }) as Stats,
    addUri: async (uri) => (calls.push(`add ${uri}`), "fff000"),
    pause: async (id) => void calls.push(`pause ${id}`),
    resume: async (id) => void calls.push(`resume ${id}`),
    remove: async (id) => void calls.push(`remove ${id}`),
  };
  return { d, calls };
}

test("help, clear, exit, unknown", async () => {
  const { d } = deps();
  assert.match((await run("help", d)).lines.join("\n"), /pause <id-prefix>/);
  assert.equal((await run("clear", d)).action, "clear");
  assert.equal((await run("exit", d)).action, "exit");
  assert.deepEqual((await run("frobnicate now", d)).lines, ["Command not found: frobnicate"]);
});

test("list and status", async () => {
  const { d } = deps();
  const list = (await run("list", d)).lines;
  assert.ok(list.some((l) => l === "abc123 | ubuntu.iso | downloading | 50%"));
  assert.deepEqual((await run("status", d)).lines.map((l) => l.replace(/\u00a0/g, " ")), [
    "Download: 2.0 KB/s | Upload: 0 B/s",
    "Active: 1 | Total: 2",
    "Ratio: 1.50",
  ]);
});

test("id prefix must be unique", async () => {
  const { d, calls } = deps();
  assert.match((await run("pause ab", d)).lines[0], /Ambiguous/);
  assert.match((await run("pause zz", d)).lines[0], /No torrent matches/);
  assert.match((await run("pause", d)).lines[0], /Usage/);
  await run("pause abc", d);
  await run("RESUME abd", d);
  await run("remove abc1", d);
  assert.deepEqual(calls, ["pause abc123", "resume abd456", "remove abc123"]);
});

test("add prints id, errors are printed", async () => {
  const { d, calls } = deps();
  assert.deepEqual((await run("add magnet:?xt=urn:btih:fff", d)).lines, ["Added torrent fff000"]);
  assert.deepEqual(calls, ["add magnet:?xt=urn:btih:fff"]);
  d.list = async () => {
    throw new Error("engine down");
  };
  assert.deepEqual((await run("list", d)).lines, ["Error: engine down"]);
});

test("isNewer and pieceCells", () => {
  assert.ok(isNewer("v0.2.0", "0.1.9"));
  assert.ok(!isNewer("0.1.0", "0.1.0"));
  assert.ok(!isNewer("0.1.0-rc1", "0.1.0"));
  // 0b11110000 0b10000000 → 9 pieces; 3 cells of 3 pieces each.
  assert.deepEqual(pieceCells(btoa("\xf0\x80"), 9, 3), ["have", "partial", "partial"]);
  assert.deepEqual(pieceCells(btoa("\xff\x00"), 16, 2), ["have", "missing"]);
});
