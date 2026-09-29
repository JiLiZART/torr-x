import { useMemo, useState } from "react";
import { AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import type { Tab, Torrent } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { TorrentItem, type TorrentAction } from "./TorrentItem";

type SortColumn = "name" | "size" | "progress" | "seeds" | "peers" | "download" | "upload" | "eta";
type SortDirection = "asc" | "desc";

interface TorrentListProps {
  torrents: Torrent[];
  activeTabId: string;
  tabs: Tab[];
  searchQuery: string;
  selectedTorrentId: string | null;
  onSelectTorrent: (id: string | null) => void;
  onMoveToTab: (torrent: Torrent, tabId: string | null) => void;
  onAction: (torrent: Torrent, action: TorrentAction) => void;
  engineError: string | null;
  onOpenSettings: () => void;
}

const COLUMNS: { id: SortColumn; width: string }[] = [
  { id: "name", width: "flex-1 px-2 text-left" },
  { id: "size", width: "w-20 text-right px-2" },
  { id: "progress", width: "w-24 text-right px-2" },
  { id: "seeds", width: "w-20 text-right px-2" },
  { id: "peers", width: "w-20 text-right px-2" },
  { id: "download", width: "w-24 text-right px-2" },
  { id: "upload", width: "w-24 text-right px-2" },
  { id: "eta", width: "w-20 text-right px-2" },
];

/** Unknown ETA (paused, complete, stalled) is null and always sorts last. */
const etaKey = (t: Torrent) =>
  t.status === "paused" || t.progress >= 1 || t.etaSecs == null ? null : t.etaSecs;

const KEYS: Record<Exclude<SortColumn, "name" | "eta">, (t: Torrent) => number> = {
  size: (t) => t.size,
  progress: (t) => t.progress,
  seeds: (t) => t.seeds,
  peers: (t) => t.peers,
  download: (t) => t.downloadRate,
  upload: (t) => t.uploadRate,
};

const ASCII = `  _______                         _
 |__   __|                       | |
    | | ___  _ __ _ __ ___ _ __ | |_ ___
    | |/ _ \\| '__| '__/ _ \\ '_ \\| __/ __|
    | | (_) | |  | | |  __/ | | | |_\\__ \\
    |_|\\___/|_|  |_|  \\___|_| |_|\\__|___/
`;

export function TorrentList({
  torrents,
  activeTabId,
  tabs,
  searchQuery,
  selectedTorrentId,
  onSelectTorrent,
  onMoveToTab,
  onAction,
  engineError,
  onOpenSettings,
}: TorrentListProps) {
  const { t } = useUi();
  const [draggingTorrentId, setDraggingTorrentId] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const visible = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const userTab = tabs.find((tab) => tab.id === activeTabId);
    const filtered = torrents.filter((tor) => {
      if (activeTabId === "downloading" && tor.status !== "downloading") return false;
      if (activeTabId === "completed" && tor.progress < 1) return false;
      if (userTab && !userTab.torrentIds.includes(tor.id)) return false;
      return !query || tor.name.toLowerCase().includes(query);
    });
    const dir = sortDirection === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sortColumn === "name") return a.name.localeCompare(b.name) * dir;
      if (sortColumn === "eta") {
        const [x, y] = [etaKey(a), etaKey(b)];
        if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;
        return (x - y) * dir;
      }
      return (KEYS[sortColumn](a) - KEYS[sortColumn](b)) * dir;
    });
  }, [torrents, tabs, activeTabId, searchQuery, sortColumn, sortDirection]);

  return (
    <div className="flex-1 overflow-auto">
      {engineError && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-950/60 border-b border-red-900/60 text-sm text-red-300">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1 break-all">{engineError}</span>
          <button onClick={onOpenSettings} className="underline hover:text-red-100">
            {t("list.openSettings")}
          </button>
        </div>
      )}
      <div className="px-4 py-2 border-b border-tx-accent-900/30 bg-tx-surface-950 flex text-xs text-tx-accent-600 font-semibold">
        {COLUMNS.map((c) => (
          <button
            key={c.id}
            onClick={() => handleSort(c.id)}
            className={`${c.width} hover:text-tx-accent-400 transition-colors`}
          >
            {t(`list.col.${c.id}`)}{" "}
            {sortColumn === c.id &&
              (sortDirection === "asc" ? (
                <ChevronUp size={14} className="inline ml-1" />
              ) : (
                <ChevronDown size={14} className="inline ml-1" />
              ))}
          </button>
        ))}
      </div>
      <div className="divide-y divide-tx-accent-900/20">
        {visible.map((torrent) => (
          <TorrentItem
            key={torrent.id}
            torrent={torrent}
            isSelected={selectedTorrentId === torrent.id}
            onClick={() => onSelectTorrent(selectedTorrentId === torrent.id ? null : torrent.id)}
            onDragStart={() => setDraggingTorrentId(torrent.id)}
            onDragEnd={() => setDraggingTorrentId(null)}
            isDragging={draggingTorrentId === torrent.id}
            tabs={tabs}
            onMoveToTab={(tabId) => onMoveToTab(torrent, tabId)}
            onAction={(action) => onAction(torrent, action)}
          />
        ))}
        {visible.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-tx-accent-700">
            <div className="text-center mb-4">
              <pre className="text-xs">{ASCII}</pre>
            </div>
            <p>
              {searchQuery ? t("list.emptySearch", { query: searchQuery }) : t("list.empty")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
