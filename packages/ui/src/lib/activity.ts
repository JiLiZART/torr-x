import type { Torrent } from "@torrentx/api-client";

/** Rates in bytes/s; `done` = completed payload bytes, used to derive `disk`. */
export interface Sample {
  t: number;
  down: number;
  up: number;
  disk: number;
  done: number;
}

export type History = Map<string, Sample[]>;

/** ~90 s at the 1.5 s list refresh. */
export const MAX_SAMPLES = 60;
/** A longer pause (hidden tab, reconnect) restarts the history instead of drawing a false slope. */
const GAP_MS = 10_000;

export const isActive = (t: Torrent) => t.status === "downloading" || t.status === "seeding";

/** Appends one sample per active torrent; inactive or removed torrents are dropped. */
export function pushSample(prev: History, torrents: Torrent[], now: number): History {
  const next: History = new Map();
  for (const tor of torrents) {
    if (!isActive(tor)) continue;
    let old = prev.get(tor.id) ?? [];
    const last = old.at(-1);
    if (last && (now - last.t > GAP_MS || now <= last.t)) old = [];
    const prior = old.at(-1);
    const done = tor.progress * tor.size;
    const disk = prior ? Math.max(0, (done - prior.done) / ((now - prior.t) / 1000)) : 0;
    const sample = { t: now, down: tor.downloadRate, up: tor.uploadRate, disk, done };
    next.set(tor.id, [...old, sample].slice(-MAX_SAMPLES));
  }
  return next;
}

export interface GraphPaths {
  down: string;
  up: string;
  disk: string;
}

/**
 * SVG paths in a 0..100 viewBox; newest sample at the right edge, one slot per sample.
 * Scaled to the row's own peak across all series, with 10% headroom.
 */
export function graphPaths(samples: Sample[]): GraphPaths {
  const peak = Math.max(1, ...samples.flatMap((s) => [s.down, s.up, s.disk]));
  const step = 100 / (MAX_SAMPLES - 1);
  const x = (i: number) => (100 - (samples.length - 1 - i) * step).toFixed(2);
  const y = (v: number) => (100 - (v / peak) * 90).toFixed(2);
  const line = (key: "down" | "up" | "disk") =>
    samples.map((s, i) => `${i ? "L" : "M"}${x(i)} ${y(s[key])}`).join(" ");
  return {
    down: `M${x(0)} 100 ${line("down").replace(/^M/, "L")} L100 100 Z`,
    up: line("up"),
    disk: line("disk"),
  };
}
