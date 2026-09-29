import type { DateFormat, Status, Torrent } from "@torrentx/api-client";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function bytes(n: number): string {
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${UNITS[i]}`;
}

const NBSP = "\u00a0";
const RATE_WIDTH = 10;

/**
 * Always RATE_WIDTH chars (monospace UI) so live values like "757.2 KB/s" → "1.0 MB/s"
 * don't shift the layout. Units switch at 1000 so the number stays ≤ 3 integer digits.
 */
export function rate(n: number): string {
  if (!(n > 0)) return "-".padStart(RATE_WIDTH, NBSP);
  let i = 0;
  while (n >= (i === 0 ? 999.5 : 999.95) && i < UNITS.length - 1) {
    n /= 1024;
    i++;
  }
  const num = n.toFixed(i === 0 ? 0 : 1).padStart(5, NBSP);
  return `${num} ${UNITS[i].padEnd(2, NBSP)}/s`;
}

export function percent(p: number): string {
  return `${Math.floor(p * 1000) / 10}%`;
}

export function duration(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.ceil(secs / 60)}m`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  return `${Math.floor(secs / 86400)}d ${Math.floor((secs % 86400) / 3600)}h`;
}

/** ETA text for a non-paused torrent. */
export function eta(t: Torrent): string {
  if (t.progress >= 1) return "-";
  return t.etaSecs == null ? "∞" : duration(t.etaSecs);
}

const pad = (n: number) => String(n).padStart(2, "0");
const RELATIVE: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
  ["second", 1],
];

export function formatDate(unixSecs: number | null, fmt: DateFormat, lang: string): string {
  if (!unixSecs || unixSecs <= 0) return "-";
  const d = new Date(unixSecs * 1000);
  if (fmt === "iso") return d.toISOString().slice(0, 19);
  if (fmt === "absolute") {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  const diff = unixSecs - Date.now() / 1000;
  const [unit, size] = RELATIVE.find(([, s]) => Math.abs(diff) >= s) ?? ["second", 1];
  return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(Math.round(diff / size), unit);
}

export function isLoopback(bind: string): boolean {
  return bind.startsWith("127.") || bind === "::1" || bind === "localhost";
}

/** True when `latest` (e.g. "v1.2.0") is a higher x.y.z than `current`; pre-release suffixes are ignored. */
export function isNewer(latest: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(/[-+]/)[0].split(".").map((n) => Number(n) || 0);
  const [a, b] = [parse(latest), parse(current)];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

export type Cell = "have" | "partial" | "missing";

/** Buckets a base64 MSB-first piece bitfield into at most `max` cells. */
export function pieceCells(bitfield: string, count: number, max = 400): Cell[] {
  const raw = atob(bitfield);
  const has = (i: number) => ((raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1) === 1;
  const cells = Math.min(count, max);
  return Array.from({ length: cells }, (_, c) => {
    const from = Math.floor((c * count) / cells);
    const to = Math.floor(((c + 1) * count) / cells);
    let n = 0;
    for (let i = from; i < to; i++) if (has(i)) n++;
    return n === to - from ? "have" : n === 0 ? "missing" : "partial";
  });
}

/** Status stripe/bar color. */
export function statusColor(status: Status): string {
  switch (status) {
    case "downloading":
      return "bg-blue-600";
    case "seeding":
      return "bg-green-600";
    case "paused":
      return "bg-yellow-600";
    case "error":
      return "bg-red-600";
    default:
      return "bg-gray-600";
  }
}
