import assert from "node:assert/strict";
import { test } from "node:test";
import type { Settings } from "@torrentx/api-client";
import { changeClass, deepLink, getPath, parseDeepLink, randomPort, ROWS, searchRows, setPath, settingsBody } from "./settings.ts";

const base = {
  server: { bind: "127.0.0.1", port: 9977, allowedHosts: [] },
  auth: { enabled: false, username: "" },
  engine: { kind: "rqbit", rqbit: { downloadDir: "/dl" }, transmission: { host: "h", port: 9091, path: "/rpc", https: false, username: "", hasPassword: true } },
  network: { listenPort: 6881, upnp: true, proxy: { type: "none", host: "", port: 1080, hasPassword: false } },
} as unknown as Settings;

test("deep links round-trip and reject other links", () => {
  assert.equal(parseDeepLink(deepLink("network")), "network");
  assert.equal(parseDeepLink("tx://settings"), "general");
  assert.equal(parseDeepLink(" TX://settings/Network/ "), "network");
  assert.equal(parseDeepLink("tx://settings/nope"), null);
  assert.equal(parseDeepLink("https://settings/network"), null);
});

test("paths read and write without touching the original", () => {
  const next = setPath(base, "network.listenPort", 51413);
  assert.equal(getPath(next, "network.listenPort"), 51413);
  assert.equal(getPath(base, "network.listenPort"), 6881);
});

test("change classes: port and engine restart, exposure applies, the rest saves", () => {
  assert.equal(changeClass("network.listenPort", "rqbit"), "restart");
  assert.equal(changeClass("network.proxy.host", "transmission"), "restart");
  assert.equal(changeClass("engine.kind", "rqbit"), "restart");
  assert.equal(changeClass("network.upnp", "rqbit"), "restart");
  assert.equal(changeClass("network.upnp", "transmission"), "save");
  assert.equal(changeClass("auth.enabled", "rqbit"), "apply");
  assert.equal(changeClass("server.bind", "rqbit"), "apply");
  assert.equal(changeClass("network.maxDownloadKBps", "rqbit"), "save");
});

test("the PUT body carries only the changes and no read-only flags", () => {
  const body = settingsBody(base, { "network.listenPort": 51413 });
  assert.equal(body.network.listenPort, 51413);
  assert.equal(body.network.upnp, true);
  assert.equal("hasPassword" in body.engine.transmission, false);
  assert.equal("hasPassword" in body.network.proxy, false);
  assert.equal(base.engine.transmission.hasPassword, true);
});

test("search finds the proxy rows with their section, title matches first", () => {
  const label = (row: { id: string; section: string }) => ({
    title: row.id === "proxyType" ? "Proxy type" : row.id === "proxyAddress" ? "Proxy address" : row.id,
    desc: row.id === "encryption" ? "not a proxy thing" : "",
    section: row.section,
  });
  const hits = searchRows("proxy", label);
  assert.deepEqual(hits.slice(0, 2).map((h) => h.id), ["proxyType", "proxyAddress"]);
  assert.ok(hits.every((h) => h.section === "network"));
  assert.equal(hits.at(-1)?.id, "encryption");
  assert.deepEqual(searchRows("  ", label), []);
});

test("row ids are unique", () => {
  assert.equal(new Set(ROWS.map((r) => r.id)).size, ROWS.length);
});

test("random port stays in the dynamic range and moves", () => {
  assert.equal(randomPort(1, () => 0), 49152);
  assert.equal(randomPort(49152, () => 0), 49153);
  assert.ok(randomPort(6881, () => 0.999) <= 65535);
});
