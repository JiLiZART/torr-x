import type { Torrent } from "@torrentx/api-client";

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function bytes(n: number): string {
  let i = 0;
  while (n >= 1024 && i < UNITS.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${UNITS[i]}`;
}

export function rate(n: number): string {
  return n > 0 ? `${bytes(n)}/s` : "-";
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

export function eta(t: Torrent): string {
  if (t.status === "paused") return "paused";
  if (t.progress >= 1) return "-";
  return t.etaSecs == null ? "∞" : duration(t.etaSecs);
}

export function date(unixSecs: number): string {
  return unixSecs > 0 ? new Date(unixSecs * 1000).toLocaleString() : "-";
}

export function magnet(t: Torrent): string {
  return `magnet:?xt=urn:btih:${t.id}&dn=${encodeURIComponent(t.name)}`;
}

export function isLoopback(bind: string): boolean {
  return bind.startsWith("127.") || bind === "::1" || bind === "localhost";
}
