import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate, parse } from "@torrentx/query";
import { fileRow, isTorrentLink, selectShown, sourceName } from "./addFlow.ts";

const GB = 1024 ** 3;
const files = [
  { index: 0, path: "Movie/Movie.2160p.mkv", size: 40 * GB },
  { index: 1, path: "Movie/Sample/sample.mkv", size: 0.1 * GB },
  { index: 2, path: "Movie/Subs/English.srt", size: 1000 },
].map(fileRow);
const shown = (query: string) => files.filter((f) => evaluate(parse(query).ast!, f)).map((f) => f.index);

test("file rows speak the query language", () => {
  assert.deepEqual(shown("ext:mkv size:>1GB"), [0]);
  assert.deepEqual(shown("ext:srt"), [2]);
  assert.deepEqual(shown("sample"), [1], "bare words match the base name");
  assert.deepEqual(shown("path:subs"), [2]);
  assert.equal(files[0].name, "Movie.2160p.mkv");
});

test("select all / none / invert act on shown files and keep hidden ones", () => {
  const selected = new Set([0, 1, 2]);
  assert.deepEqual([...selectShown(selected, [1, 2], "none")], [0]);
  assert.deepEqual([...selectShown(new Set([2]), [0, 1], "all")].sort(), [0, 1, 2]);
  assert.deepEqual([...selectShown(new Set([0, 2]), [0, 1], "invert")].sort(), [1, 2]);
});

test("torrent links and names", () => {
  const magnet = "magnet:?xt=urn:btih:dd8255ecdc7ca55fb0bbf81323d87062db1f6d1c&dn=Big+Buck+Bunny";
  assert.ok(isTorrentLink(magnet));
  assert.ok(isTorrentLink("https://example.org/files/ubuntu.torrent?x=1"));
  assert.ok(!isTorrentLink("https://example.org/page"));
  assert.ok(!isTorrentLink("ubuntu"));
  assert.equal(sourceName({ kind: "uri", uri: magnet }), "Big Buck Bunny");
  assert.equal(sourceName({ kind: "uri", uri: "https://example.org/files/ubuntu.torrent" }), "ubuntu.torrent");
});
