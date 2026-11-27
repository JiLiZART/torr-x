import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate, FILE_SCOPE, parse, PEER_SCOPE, TRACKER_SCOPE } from "@torrentx/query";
import { fileActionBlock, fileClass, FILE_ACTIONS, fileKind, fileRow, fileTree, treeLines, type FileRow, joinPath, peerRow, swarm, trackerRow, trackerStatus, webSeedRow } from "./detail.ts";
import { episodeCode, episodeState, headNeed, mediaEpisodes, parseEpisode, qualityTags } from "./media.ts";

test("episodes: codes, quality tags, titles only when named", () => {
  const e = parseEpisode("Arcane.S02/Arcane.S02E04.2160p.NF.WEB-DL.DDP5.1.Atmos.DV.HDR10.H.265-FLUX.mkv")!;
  assert.deepEqual([e.season, e.ep, e.title, e.show], [2, 4, null, "arcane"]);
  assert.deepEqual(e.quality, ["2160p", "DDP5.1", "Atmos", "DV", "HDR10"]);
  assert.equal(parseEpisode("The.Bear.S03E01.Tomorrow.1080p.WEB.mkv")!.title, "Tomorrow");
  assert.equal(parseEpisode("show - 2x07 - The Long Night [1080p].mkv")!.title, "The Long Night");
  assert.equal(parseEpisode("Severance.S02E09.2160p.ATVP-GROUP.mkv")!.title, null);
  assert.equal(parseEpisode("Blade.Runner.2049.2160p.mkv"), null);
  const anime = parseEpisode("Cyberpunk Edgerunners - 03 [BDRip 1080p HEVC 10bits FLAC].mkv")!;
  assert.deepEqual([anime.season, anime.ep, anime.show, anime.title, anime.quality], [1, 3, "cyberpunk edgerunners", null, ["1080p"]]);
  assert.equal(parseEpisode("[SubsPlease] Frieren - 12v2 (1080p).mkv")!.show, "frieren");
  assert.equal(parseEpisode("Movie - 2019.mkv"), null);
  assert.equal(episodeCode({ season: 2, ep: 4 }), "S02E04");
  assert.deepEqual(qualityTags("Movie.1080p.BluRay.x264.DD5.1"), ["1080p", "DD5.1"]);
});

test("media mode needs two episodes of one show", () => {
  const f = (index: number, path: string) => ({ index, path, size: 1, progress: 0, wanted: true });
  const season = [f(0, "S/Arcane.S02E02.mkv"), f(1, "S/Arcane.S02E01.mkv"), f(2, "S/Sample/Arcane.S02E01.sample.mkv"), f(3, "S/Subs/Arcane.S02E01.srt")];
  assert.deepEqual(mediaEpisodes(season)!.map((e) => e.ep), [1, 2], "samples and subtitles are not episodes; sorted");
  assert.equal(mediaEpisodes([f(0, "Arcane.S02E01.mkv")]), null);
  assert.equal(mediaEpisodes([f(0, "Arcane.S02E01.mkv"), f(1, "Dune.S01E01.mkv")]), null, "two shows");
  assert.equal(mediaEpisodes([f(0, "movie.mkv"), f(1, "extras.mkv")]), null);
  assert.equal(episodeState({ ...f(0, "x"), progress: 1 }, true), "ready");
  assert.equal(episodeState({ ...f(0, "x"), progress: 0.3 }, true), "downloading");
  assert.equal(episodeState({ ...f(0, "x"), progress: 0.3 }, false), "queued");
  assert.equal(episodeState({ ...f(0, "x"), wanted: false }, true), "skipped");
});

test("section rows feed the section scopes", () => {
  const files = [
    fileRow({ index: 0, path: "S/Arcane.S02E04.mkv", size: 2 ** 31, progress: 0.5, wanted: true, priority: "normal", cover: null }),
    fileRow({ index: 1, path: "S/Arcane.S02E05.mkv", size: 2 ** 31, progress: 0, wanted: false, priority: "normal", cover: null }),
    fileRow({ index: 2, path: "S/Subs/en.srt", size: 10, progress: 1, wanted: true, priority: "high", cover: null }),
  ];
  assert.deepEqual([files[1].priority, files[0].ep, files[2].ep, files[2].ext], ["skip", 4, null, "srt"]);
  const shown = (q: string) => files.filter((r) => evaluate(parse(q, FILE_SCOPE).ast!, r)).map((r) => r.index);
  assert.deepEqual(shown("ext:mkv priority:!skip"), [0]);
  assert.deepEqual(shown("ep:>3"), [0, 1]);

  const peer = peerRow({ address: "1.2.3.4:5", client: "qB", country: "DE", progress: 0.5, downloadRate: 9, uploadRate: 1, flags: "DUE", encryption: "rc4", isSeed: false });
  assert.deepEqual([peer.letters, peer.flags, peer.progress], [["D", "U", "E"], ["downloading", "uploading", "encrypted"], 50]);
  assert.ok(evaluate(parse("country:!CN flags:!snubbed", PEER_SCOPE).ast!, peer));

  const base = { kind: "tracker" as const, tier: 0, error: null, lastAnnounce: null, nextAnnounce: null, seeds: null, leechers: null, downloaded: null };
  const status = (s: string | null, error: string | null = null) => trackerStatus({ ...base, url: "u", status: s, error });
  assert.deepEqual(
    [status("working"), status("announcing"), status("inactive"), status(null), status("Connection failed"), status("working", "refused")],
    ["working", "updating", "disabled", "unknown", "not working", "not working"],
  );
  const rows = [trackerRow({ ...base, url: "a", status: "inactive" }), trackerRow({ ...base, url: "b", status: "working", seeds: 112, leechers: 31 })];
  assert.deepEqual(rows.filter((r) => evaluate(parse("status:!disabled", TRACKER_SCOPE).ast!, r)).map((r) => r.url), ["b"]);
  assert.deepEqual(swarm(rows.map((r) => r.tracker)), { seeds: 112, leechers: 31 });
  assert.deepEqual(swarm([]), { seeds: null, leechers: null });
  assert.equal(webSeedRow({ url: "u", kind: "bep19", status: null, speed: null, downloaded: null, error: "HTTP 404" }).status, "failed");
});

test("streaming starts once 2% or 8 MiB of the file is in", () => {
  const MiB = 1024 * 1024;
  assert.equal(headNeed({ size: 100 * MiB, progress: 0 }), 8 * MiB);
  assert.equal(headNeed({ size: 2000 * MiB, progress: 0.01 }), 20 * MiB);
  assert.equal(headNeed({ size: 2000 * MiB, progress: 0.4 }), 0);
  assert.equal(headNeed({ size: 4 * MiB, progress: 0.5 }), 2 * MiB);
});

test("file actions follow the format and say why they cannot run", () => {
  assert.deepEqual(FILE_ACTIONS[fileClass("mkv")], ["play", "library", "cast"]);
  assert.deepEqual(FILE_ACTIONS[fileClass("iso")], ["contents", "mount"]);
  assert.deepEqual(FILE_ACTIONS[fileClass("nfo")], ["open", "reveal", "copyPath"]);
  const ctx = { openFile: undefined, stream: undefined, local: true, done: true };
  assert.equal(fileActionBlock("open", ctx), null);
  assert.equal(fileActionBlock("open", { ...ctx, local: false }), "remote");
  assert.equal(fileActionBlock("reveal", { ...ctx, openFile: "not supported by x" }), "engine");
  assert.equal(fileActionBlock("open", { ...ctx, done: false }), "notOnDisk");
  assert.equal(fileActionBlock("reveal", { ...ctx, done: false }), null);
  assert.equal(fileActionBlock("play", ctx), null);
  assert.equal(fileActionBlock("play", { ...ctx, done: false, stream: "not supported by x" }), "engine");
  assert.equal(fileActionBlock("play", { ...ctx, local: false, stream: "not supported by x" }), "remote");
  assert.equal(fileActionBlock("play", { ...ctx, local: false, done: false }), null);
  assert.equal(fileActionBlock("play", { ...ctx, done: false, need: 1024 }), "notReady");
  assert.equal(fileActionBlock("play", { ...ctx, done: false, need: 0 }), null);
  assert.equal(fileActionBlock("library", ctx), "notYet");
  assert.equal(fileActionBlock("copyPath", { ...ctx, local: false }), null);
  assert.equal(joinPath("/data/", "a/b.mkv"), "/data/a/b.mkv");
  assert.equal(joinPath("C:\\Downloads", "a/b.mkv"), "C:\\Downloads\\a\\b.mkv");
});

test("fileKind: extensions map to file-manager kinds", () => {
  assert.equal(fileKind("txt"), "text");
  assert.equal(fileKind("mkv"), "video");
  assert.equal(fileKind("flac"), "audio");
  assert.equal(fileKind("srt"), "subtitle");
  assert.equal(fileKind("r07"), "archive");
  assert.equal(fileKind(""), "other");
});

test("fileTree: folders first with totals, files keep their order, collapse hides children", () => {
  const f = (index: number, path: string, size: number, done: number, priority: FileRow["priority"] = "normal"): FileRow => ({
    index, path, name: path.split("/").pop()!, ext: "", size, done, priority, ep: null, season: null,
  });
  const tree = fileTree([f(0, "Show/readme.txt", 10, 100), f(1, "Show/S01/e2.mkv", 30, 0, "skip"), f(2, "Show/S01/e1.mkv", 60, 50), f(3, "top.nfo", 1, 0)]);
  assert.deepEqual(tree.map((n) => (n.kind === "dir" ? n.path : n.row.path)), ["Show", "top.nfo"]);
  const show = tree[0];
  assert.ok(show.kind === "dir");
  assert.equal(show.size, 100);
  assert.equal(show.done, 40);
  assert.equal(show.wanted, "some");
  assert.deepEqual(show.children.map((n) => (n.kind === "dir" ? n.path : n.row.name)), ["Show/S01", "readme.txt"]);
  const s01 = show.children[0];
  assert.ok(s01.kind === "dir");
  assert.deepEqual(s01.children.map((n) => (n.kind === "file" ? n.row.name : "")), ["e2.mkv", "e1.mkv"]);
  assert.deepEqual(treeLines(tree, new Set()).map((l) => l.depth), [0, 1, 2, 2, 1, 0]);
  assert.deepEqual(treeLines(tree, new Set(["Show/S01"])).length, 4);
});
