import { test } from "node:test";
import assert from "node:assert/strict";
import { canCapture, captureKey, episodeLookup, frameSize, mainVideo, onceQueue, parseTitle, seekTime, torrentLookup } from "./cover.ts";
import { mediaEpisodes } from "./media.ts";

const file = (index: number, path: string, size = 1, progress = 1, wanted = true) => ({ index, path, size, progress, wanted });

test("the frame is taken at 3% of the video, never past a minute", () => {
  assert.equal(seekTime(100), 3);
  assert.equal(seekTime(7200), 60);
  assert.equal(seekTime(2), 0.06);
  // Unknown duration counts as 10 minutes: never the first, often black, frame.
  assert.equal(seekTime(NaN), 18);
  assert.equal(seekTime(0), 18);
  assert.equal(seekTime(Infinity), 60);
});

test("frames are scaled down to 640 px, never up", () => {
  assert.deepEqual(frameSize(1920, 1080), { width: 640, height: 360 });
  assert.deepEqual(frameSize(320, 240), { width: 320, height: 240 });
});

test("parseTitle reads the title and the year a release name states", () => {
  assert.deepEqual(parseTitle("Big.Buck.Bunny.2008.1080p.x264-GRP"), { title: "Big Buck Bunny", year: 2008 });
  assert.deepEqual(parseTitle("Big Buck Bunny"), { title: "Big Buck Bunny" });
  assert.deepEqual(parseTitle("Blade.Runner.2049.2017.2160p.UHD.BluRay"), { title: "Blade Runner 2049", year: 2017 });
  assert.deepEqual(parseTitle("2001.A.Space.Odyssey.1968.720p.mkv"), { title: "2001 A Space Odyssey", year: 1968 });
  assert.deepEqual(parseTitle("[Group] Some Film (2019) [1080p]"), { title: "Some Film", year: 2019 });
  assert.deepEqual(parseTitle("the office 2005"), { title: "the office", year: 2005 });
  assert.deepEqual(parseTitle("Arcane.S02.1080p.WEB"), { title: "Arcane" });
  assert.deepEqual(parseTitle("1917"), { title: "1917" });
});

test("a lookup is a show when the files are episodes, a movie otherwise, and nothing for other torrents", () => {
  const film = [file(0, "Film.2008.1080p/film.mkv", 900), file(1, "Film.2008.1080p/poster.jpg", 5)];
  assert.deepEqual(torrentLookup("Film.2008.1080p", film, mediaEpisodes(film)), { kind: "movie", title: "Film", year: 2008 });

  const pack = [file(0, "S/Arcane.S02E04.1080p.mkv", 5), file(1, "S/Arcane.S02E05.1080p.mkv", 6)];
  const episodes = mediaEpisodes(pack)!;
  assert.deepEqual(torrentLookup("Arcane.S02.1080p.WEB-GRP", pack, episodes), { kind: "tv", title: "arcane" });
  assert.deepEqual(episodeLookup(episodes[1], "Arcane.S02.1080p.WEB-GRP"), { kind: "tv", title: "arcane", season: 2, episode: 5, file: 1 });

  const album = [file(0, "A/01.flac", 50), file(1, "A/cover.jpg", 5)];
  assert.equal(torrentLookup("Album 2001", album, null), null);
  assert.equal(mainVideo(album), null);
  assert.equal(mainVideo(pack)?.index, 1);
  // The largest video, even when another file is larger; `.ts` is not captured.
  assert.equal(mainVideo([file(0, "a.iso", 900), file(1, "a.mp4", 5), file(2, "b.ogv", 9), file(3, "c.ts", 50)])?.index, 2);
  assert.equal(mainVideo([]), null);
});

test("capture waits for an active torrent, a wanted file and some data", () => {
  assert.ok(canCapture(file(0, "a.mp4", 1, 1), "seeding"));
  assert.ok(canCapture(file(0, "a.mp4", 1, 0.1), "downloading"));
  assert.ok(!canCapture(file(0, "a.mp4", 1, 0.05), "downloading"));
  // A stream link would resume the torrent and select the file: never for these.
  assert.ok(!canCapture(file(0, "a.mp4", 1, 1), "paused"));
  assert.ok(!canCapture(file(0, "a.mp4", 1, 0.5, false), "downloading"));
  assert.notEqual(captureKey("ab", file(0, "a.mp4", 1, 0.5)), captureKey("ab", file(0, "a.mp4", 1, 1)));
});

test("the queue runs one job at a time and tries a key once, failed or not", async () => {
  const run = onceQueue();
  const log: string[] = [];
  const job = (name: string, fail = false) => async () => {
    log.push(`${name}>`);
    await new Promise((r) => setTimeout(r, 5));
    log.push(`<${name}`);
    if (fail) throw new Error("cannot decode");
  };
  const all = [run("a", job("a", true)), run("b", job("b")), run("a", job("a again"))];
  await Promise.all(all);
  assert.deepEqual(log, ["a>", "<a", "b>", "<b"]);
  await run("b", job("b again"));
  await run("c", job("c"));
  assert.deepEqual(log, ["a>", "<a", "b>", "<b", "c>", "<c"]);
});
