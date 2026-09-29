import type { Torrent } from "@torrentx/api-client";

export type Filter = "all" | "downloading" | "seeding" | "paused" | "completed";

export const FILTERS: { id: Filter; name: string }[] = [
  { id: "all", name: "All" },
  { id: "downloading", name: "Downloading" },
  { id: "seeding", name: "Seeding" },
  { id: "paused", name: "Paused" },
  { id: "completed", name: "Completed" },
];

export function matchesFilter(t: Torrent, f: Filter): boolean {
  switch (f) {
    case "all":
      return true;
    case "completed":
      return t.progress >= 1;
    default:
      return t.status === f;
  }
}
