import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Torrent } from "@torrentx/api-client";
import type { Action } from "../App";
import { TorrentItem } from "./TorrentItem";
import { matchesFilter, type Filter } from "../lib/filters";

interface TorrentListProps {
  torrents: Torrent[];
  filter: Filter;
  search: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAction: (t: Torrent, a: Action) => void;
}

type SortColumn = "name" | "size" | "progress" | "seeds" | "peers" | "download" | "upload" | "eta";

const COLUMNS: { id: SortColumn; label: string; width: string }[] = [
  { id: "name", label: "NAME", width: "flex-1 text-left" },
  { id: "size", label: "SIZE", width: "w-24 text-right" },
  { id: "progress", label: "PROGRESS", width: "w-24 text-right" },
  { id: "seeds", label: "SEEDS", width: "w-16 text-right" },
  { id: "peers", label: "PEERS", width: "w-16 text-right" },
  { id: "download", label: "DOWN", width: "w-24 text-right" },
  { id: "upload", label: "UP", width: "w-24 text-right" },
  { id: "eta", label: "ETA", width: "w-20 text-right" },
];

const sortKey: Record<SortColumn, (t: Torrent) => number | string> = {
  name: (t) => t.name.toLowerCase(),
  size: (t) => t.size,
  progress: (t) => t.progress,
  seeds: (t) => t.seeds,
  peers: (t) => t.peers,
  download: (t) => t.downloadRate,
  upload: (t) => t.uploadRate,
  eta: (t) => t.etaSecs ?? Infinity,
};

export function TorrentList({ torrents, filter, search, selectedId, onSelect, onAction }: TorrentListProps) {
  const [sort, setSort] = useState<{ col: SortColumn; asc: boolean }>({ col: "name", asc: true });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const key = sortKey[sort.col];
    return torrents
      .filter((t) => matchesFilter(t, filter) && (!q || t.name.toLowerCase().includes(q)))
      .sort((a, b) => {
        const [x, y] = [key(a), key(b)];
        const c = x < y ? -1 : x > y ? 1 : 0;
        return sort.asc ? c : -c;
      });
  }, [torrents, filter, search, sort]);

  const toggleSort = (col: SortColumn) =>
    setSort((s) => (s.col === col ? { col, asc: !s.asc } : { col, asc: true }));

  return (
    <div className="flex-1 overflow-auto">
      <div className="px-4 py-2 border-b border-green-900/30 bg-gray-950 flex text-xs text-green-600 font-semibold sticky top-0">
        {COLUMNS.map((c) => (
          <button
            key={c.id}
            onClick={() => toggleSort(c.id)}
            className={`${c.width} px-2 hover:text-green-400 transition-colors`}
          >
            {c.label}
            {sort.col === c.id &&
              (sort.asc ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />)}
          </button>
        ))}
      </div>
      <div className="divide-y divide-green-900/20">
        {visible.map((t) => (
          <TorrentItem
            key={t.id}
            torrent={t}
            selected={t.id === selectedId}
            onClick={() => onSelect(t.id)}
            onAction={(a) => onAction(t, a)}
          />
        ))}
      </div>
      {visible.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 text-green-700 text-sm">
          <pre className="text-xs mb-4">{`$ torrentx ls\n(empty)`}</pre>
          {torrents.length === 0 ? (
            <p>No torrents yet. Add a magnet link or drop a .torrent file here.</p>
          ) : (
            <p>No torrents match{search ? ` "${search}"` : " this filter"}.</p>
          )}
        </div>
      )}
    </div>
  );
}
