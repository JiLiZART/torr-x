import { ArrowDown, ArrowUp, Server } from "lucide-react";
import type { Health, Torrent } from "@torrentx/api-client";
import { rate } from "../lib/format";

interface StatusBarProps {
  torrents: Torrent[];
  health: Health | null;
}

export function StatusBar({ torrents, health }: StatusBarProps) {
  const down = torrents.reduce((s, t) => s + t.downloadRate, 0);
  const up = torrents.reduce((s, t) => s + t.uploadRate, 0);
  const active = torrents.filter((t) => t.status === "downloading" || t.status === "seeding").length;
  return (
    <div className="border-t border-green-900/30 bg-gray-950 py-1 px-4 text-xs text-green-600 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <ArrowDown size={12} className="mr-1 text-green-500" />
          <span>{rate(down)}</span>
        </div>
        <div className="flex items-center">
          <ArrowUp size={12} className="mr-1 text-green-500" />
          <span>{rate(up)}</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <span>
          {torrents.length} torrents • {active} active
        </span>
        {health && (
          <span className="flex items-center">
            <Server size={12} className="mr-1 text-green-500" />
            {health.engine} • v{health.version}
          </span>
        )}
      </div>
    </div>
  );
}
