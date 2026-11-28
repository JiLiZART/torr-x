#!/usr/bin/env node
// Downloads DB-IP "IP to Country Lite" (CC BY 4.0, https://db-ip.com) for peer
// country lookup. Release builds embed it with `--features geoip`. Runs on any OS (Node 24+).
import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

const dest = join(dirname(fileURLToPath(import.meta.url)), "..", "crates", "torrentx-server", "geoip", "dbip-country-lite.mmdb");
const base = process.env.GEOIP_BASE_URL ?? "https://download.db-ip.com/free";
mkdirSync(dirname(dest), { recursive: true });

const now = new Date();
const month = (back) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7);

// The current month's file may not be published yet; fall back to last month.
for (const m of [month(0), month(1)]) {
  try {
    const res = await fetch(`${base}/dbip-country-lite-${m}.mmdb.gz`);
    if (!res.ok) continue;
    writeFileSync(`${dest}.tmp`, gunzipSync(Buffer.from(await res.arrayBuffer())));
    renameSync(`${dest}.tmp`, dest);
    console.log(`GeoIP database: ${dest} (${m})`);
    process.exit(0);
  } catch {
    // try the previous month
  }
}
rmSync(`${dest}.tmp`, { force: true });
console.error("failed to download the DB-IP country database");
process.exit(1);
