import { useMemo, useState } from "react";
import { AlertTriangle, ChevronUp, ChevronDown } from "lucide-react";
import type { Tab, Torrent } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { useActivity } from "../lib/hooks";
import { COLUMNS, type SortColumn } from "../lib/columns";
import { TorrentItem, type TorrentAction } from "./TorrentItem";

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
  const activity = useActivity(torrents);
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
        {(Object.keys(COLUMNS) as SortColumn[]).map((id) => (
          <button
            key={id}
            onClick={() => handleSort(id)}
            className={`${COLUMNS[id]} hover:text-tx-accent-400 transition-colors`}
          >
            {t(`list.col.${id}`)}{" "}
            {sortColumn === id &&
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
            samples={activity.get(torrent.id)}
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
