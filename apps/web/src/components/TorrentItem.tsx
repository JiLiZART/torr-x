import type { ReactNode } from "react";
import { Link2, Pause, Play, Trash2 } from "lucide-react";
import type { Status, Torrent } from "@torrentx/api-client";
import type { Action } from "../App";
import { bytes, eta, percent, rate } from "../lib/format";

const STATUS_COLOR: Record<Status, string> = {
  downloading: "bg-blue-600",
  seeding: "bg-green-600",
  paused: "bg-yellow-600",
  checking: "bg-cyan-600",
  queued: "bg-gray-500",
  error: "bg-red-600",
};

interface TorrentItemProps {
  torrent: Torrent;
  selected: boolean;
  onClick: () => void;
  onAction: (a: Action) => void;
}

function ActionButton({ title, onClick, children }: { title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      className="p-1 rounded hover:bg-gray-800 transition-colors"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      {children}
    </button>
  );
}

export function TorrentItem({ torrent: t, selected, onClick, onAction }: TorrentItemProps) {
  const color = STATUS_COLOR[t.status];
  return (
    <div
      className={`px-4 py-3 transition-colors cursor-pointer group relative ${
        selected ? "bg-green-900/20 hover:bg-green-900/30" : "hover:bg-gray-900/70"
      }`}
      onClick={onClick}
    >
      <div className="flex items-center text-sm text-green-400">
        <div className="flex-1 px-2 truncate">
          <div className="flex items-center" title={t.error ?? t.status}>
            <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${color}`} />
            <span className="truncate">{t.name}</span>
          </div>
          {t.error && <div className="text-xs text-red-400 truncate ml-4">{t.error}</div>}
        </div>
        <div className="w-24 text-right px-2">{bytes(t.size)}</div>
        <div className="w-24 text-right px-2">
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${color} transition-all duration-300`}
              style={{ width: `${t.progress * 100}%` }}
            />
          </div>
          <span className="text-xs mt-1 inline-block">{percent(t.progress)}</span>
        </div>
        <div className="w-16 text-right px-2">{t.seeds}</div>
        <div className="w-16 text-right px-2">{t.peers}</div>
        <div className="w-24 text-right px-2">{rate(t.downloadRate)}</div>
        <div className="w-24 text-right px-2">{rate(t.uploadRate)}</div>
        <div className="w-20 text-right px-2">{eta(t)}</div>
        <div className="hidden group-hover:flex items-center space-x-1 absolute right-4 bg-gray-950/90 px-2 py-1 rounded-md shadow-lg">
          {t.status === "paused" ? (
            <ActionButton title="Resume" onClick={() => onAction("resume")}>
              <Play size={14} className="text-green-500" />
            </ActionButton>
          ) : (
            <ActionButton title="Pause" onClick={() => onAction("pause")}>
              <Pause size={14} className="text-green-500" />
            </ActionButton>
          )}
          <ActionButton title="Copy magnet link" onClick={() => onAction("copy-magnet")}>
            <Link2 size={14} className="text-green-500" />
          </ActionButton>
          <ActionButton title="Remove" onClick={() => onAction("remove")}>
            <Trash2 size={14} className="text-red-400" />
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
