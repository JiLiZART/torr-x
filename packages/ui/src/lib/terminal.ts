import type { Stats, Torrent } from "@torrentx/api-client";
import { bytes, percent } from "./format.ts";

export interface TerminalDeps {
  list(): Promise<Torrent[]>;
  stats(): Promise<Stats>;
  addUri(uri: string): Promise<string>;
  pause(id: string): Promise<void>;
  resume(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface TerminalResult {
  lines: string[];
  action?: "clear" | "exit";
}

const HELP = [
  "Available commands:",
  "  help                  - Show this help message",
  "  list                  - List all torrents",
  "  status                - Show transfer status",
  "  add <magnet|url>      - Add a new torrent",
  "  pause <id-prefix>     - Pause a torrent",
  "  resume <id-prefix>    - Resume a torrent",
  "  remove <id-prefix>    - Remove a torrent (keeps data)",
  "  clear                 - Clear terminal",
  "  exit                  - Close terminal",
];

const DONE = { pause: "Paused", resume: "Resumed", remove: "Removed" } as const;
const speed = (n: number) => `${bytes(n)}/s`;

/** Executes one terminal command line against the API. Never throws. */
export async function run(input: string, deps: TerminalDeps): Promise<TerminalResult> {
  const [word = "", ...args] = input.trim().split(/\s+/);
  const cmd = word.toLowerCase();
  try {
    switch (cmd) {
      case "":
        return { lines: [] };
      case "help":
        return { lines: HELP };
      case "clear":
        return { lines: [], action: "clear" };
      case "exit":
        return { lines: ["Closing terminal..."], action: "exit" };
      case "list": {
        const ts = await deps.list();
        if (ts.length === 0) return { lines: ["No torrents."] };
        return {
          lines: [
            "ID       | Name | Status | Progress",
            "-".repeat(36),
            ...ts.map((t) => `${t.id.slice(0, 8)} | ${t.name} | ${t.status} | ${percent(t.progress)}`),
          ],
        };
      }
      case "status": {
        const s = await deps.stats();
        return {
          lines: [
            `Download: ${speed(s.downloadRate)} | Upload: ${speed(s.uploadRate)}`,
            `Active: ${s.active} | Total: ${s.torrents}`,
            `Ratio: ${s.ratio == null ? "-" : s.ratio.toFixed(2)}`,
          ],
        };
      }
      case "add": {
        if (args.length === 0) return { lines: ["Usage: add <magnet|url>"] };
        const id = await deps.addUri(args.join(" "));
        return { lines: [`Added torrent ${id}`] };
      }
      case "pause":
      case "resume":
      case "remove": {
        const prefix = args[0]?.toLowerCase();
        if (!prefix) return { lines: [`Usage: ${cmd} <id-prefix>`] };
        const matches = (await deps.list()).filter((t) => t.id.startsWith(prefix));
        if (matches.length === 0) return { lines: [`No torrent matches "${prefix}"`] };
        if (matches.length > 1) {
          return { lines: [`Ambiguous id prefix "${prefix}" (${matches.length} matches)`] };
        }
        const [t] = matches;
        await deps[cmd](t.id);
        return { lines: [`${DONE[cmd]} ${t.id.slice(0, 8)} ${t.name}`] };
      }
      default:
        return { lines: [`Command not found: ${word}`] };
    }
  } catch (e) {
    return { lines: [`Error: ${e instanceof Error ? e.message : String(e)}`] };
  }
}
