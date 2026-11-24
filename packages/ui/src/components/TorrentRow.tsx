import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Play,
  Pause,
  Trash2,
  MoreVertical,
  FolderOpen,
  FolderInput,
  Edit3,
  Save,
  Link2,
  CheckCircle,
  Trash,
  Tag,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import type { Torrent } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { graphPaths, isActive, type Sample } from "../lib/activity";
import { COLUMNS } from "../lib/columns";
import { bytes, percent, rate, statusBadge, statusColor } from "../lib/format";

export type TorrentAction =
  | "pause"
  | "resume"
  | "remove"
  | "erase"
  | "reveal"
  | "relocate"
  | "rename"
  | "torrentFile"
  | "magnet"
  | "verify"
  | "tags";

interface TorrentProps {
  torrent: Torrent;
  isSelected: boolean;
  onClick: () => void;
  onAction: (action: TorrentAction) => void;
  /** Dense rows: one line, no secondary line. */
  compact: boolean;
  /** Recent activity; drawn behind the row while downloading or seeding. */
  samples?: Sample[];
}

const itemClass = "w-full px-3 py-2 text-left text-sm flex items-center disabled:opacity-40 disabled:cursor-not-allowed";

function MenuItem({
  icon,
  label,
  onClick,
  hint,
  danger,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  hint?: string;
  danger?: boolean;
}) {
  return (
    <div title={hint}>
      <button
        onClick={onClick}
        disabled={!!hint}
        className={`${itemClass} ${danger ? "text-red-400 hover:bg-red-900/20" : "text-tx-accent-400 hover:bg-tx-accent-900/20"}`}
      >
        {icon}
        {label}
      </button>
    </div>
  );
}

const Divider = () => <div className="border-t border-tx-accent-900/30 my-1"></div>;

const MAX_TAGS = 2;
const tagClass = "rounded border border-tx-accent-900/40 bg-tx-surface-900 px-1.5 py-0.5 text-[11px] text-tx-accent-500";

/** A rate with its arrow, or a dash while idle; the cell width never changes. */
function Rate({ value, up }: { value: number; up?: boolean }) {
  if (value <= 0) return <span className="text-tx-accent-800">—</span>;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <span className={up ? "text-tx-accent-600" : "text-tx-accent-300"}>
      <Icon size={11} className="mr-1 inline" />
      {rate(value).trim()}
    </span>
  );
}

export function TorrentRow({ torrent, isSelected, onClick, onAction, compact, samples }: TorrentProps) {
  const { t, gate, date } = useUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => setMenuOpen(false);
  const act = (action: TorrentAction) => {
    close();
    onAction(action);
  };

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) close();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const isPaused = torrent.status === "paused";
  const color = statusColor(torrent.status);
  const graph = isActive(torrent) && samples && samples.length >= 2 ? graphPaths(samples) : null;
  // The state reason replaces "tracker · added" while the state needs explaining.
  const reason =
    torrent.status === "error"
      ? (torrent.error ?? t("status.error"))
      : torrent.status === "checking"
        ? t("row.checking")
        : isPaused
          ? t("row.paused")
          : null;
  const meta = reason ?? [torrent.tracker, t("row.added", { when: date(torrent.addedAt) })].filter(Boolean).join(" · ");
  const done = torrent.progress >= 1;

  return (
    <div
      className={`${compact ? "h-9" : "h-14"} px-4 flex items-center isolate transition-colors duration-200 cursor-pointer ${isSelected ? "bg-tx-accent-900/20 hover:bg-tx-accent-900/30" : "hover:bg-tx-surface-900/70"} group relative`}
      onClick={onClick}
    >
      {graph && (
        <svg
          className="absolute inset-0 -z-10 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d={graph.down} className="fill-tx-accent-500/10" />
          <path d={graph.disk} className="fill-none stroke-tx-accent-600/40" strokeDasharray="3 2" vectorEffect="non-scaling-stroke" />
          <path d={graph.up} className="fill-none stroke-tx-accent-700/60" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <div className="flex flex-1 min-w-0 items-center text-sm text-tx-accent-400 tabular-nums">
        <div className={`${COLUMNS.name} flex items-center`}>
          <div className={`w-2 h-2 rounded-full mr-3 shrink-0 ${color}`}></div>
          <div className="min-w-0">
            <div className="truncate" title={torrent.name}>
              {torrent.name}
            </div>
            {!compact && (
              <div className={`truncate text-[11px] ${torrent.status === "error" ? "text-red-400" : "text-tx-accent-700"}`} title={meta}>
                {meta}
              </div>
            )}
          </div>
        </div>
        <div className={`${COLUMNS.size} text-xs text-tx-accent-500`}>{bytes(torrent.size)}</div>
        <div className={COLUMNS.progress}>
          <div className="w-full bg-tx-surface-800 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${torrent.progress * 100}%` }}></div>
          </div>
          {!compact && <span className="text-[11px] text-tx-accent-500">{done ? t("row.done") : percent(torrent.progress)}</span>}
        </div>
        <div className={`${COLUMNS.down} text-xs`}>
          <Rate value={torrent.downloadRate} />
        </div>
        <div className={`${COLUMNS.up} text-xs`}>
          <Rate value={torrent.uploadRate} up />
        </div>
        <div className={`${COLUMNS.peers} text-xs text-tx-accent-500`}>{torrent.peers}</div>
        <div className={`${COLUMNS.ratio} text-xs text-tx-accent-500`}>{torrent.ratio == null ? "—" : torrent.ratio.toFixed(2)}</div>
        <div className={COLUMNS.state}>
          <span className={`rounded px-1.5 py-0.5 text-[11px] ${statusBadge(torrent.status)}`}>{t(`state.${torrent.status}`)}</span>
        </div>
        <div className={`${COLUMNS.tags} space-x-1 overflow-hidden`} title={torrent.tags.join(", ")}>
          {torrent.tags.slice(0, MAX_TAGS).map((tag) => (
            <span key={tag} className={tagClass}>
              {tag}
            </span>
          ))}
          {torrent.tags.length > MAX_TAGS && <span className={tagClass}>+{torrent.tags.length - MAX_TAGS}</span>}
        </div>
        <div className={`${COLUMNS.tracker} truncate text-xs text-tx-accent-700`} title={torrent.tracker ?? undefined}>
          {torrent.tracker ?? "—"}
        </div>
        <div
          className={`${menuOpen ? "flex" : "hidden group-hover:flex"} items-center space-x-1 ml-2 absolute right-4 bg-tx-surface-950/80 px-2 py-1 rounded-md shadow-lg backdrop-blur-sm transition-opacity duration-200`}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="p-1 rounded hover:bg-tx-surface-800 transition-colors"
            title={isPaused ? t("action.resume") : t("action.pause")}
            onClick={() => onAction(isPaused ? "resume" : "pause")}
          >
            {isPaused ? (
              <Play size={14} className="text-tx-accent-500" />
            ) : (
              <Pause size={14} className="text-tx-accent-500" />
            )}
          </button>
          <button
            className="p-1 rounded hover:bg-tx-surface-800 transition-colors"
            title={t("action.remove")}
            onClick={() => onAction("remove")}
          >
            <Trash2 size={14} className="text-tx-accent-500" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              className="p-1 rounded hover:bg-tx-surface-800 transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <MoreVertical size={14} className="text-tx-accent-500" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-tx-surface-950 border border-tx-accent-900/50 rounded-md shadow-xl z-50">
                {isPaused ? (
                  <MenuItem icon={<Play size={14} className="mr-2" />} label={t("action.resume")} onClick={() => act("resume")} />
                ) : (
                  <MenuItem icon={<Pause size={14} className="mr-2" />} label={t("action.pause")} onClick={() => act("pause")} />
                )}
                <Divider />
                <MenuItem icon={<Trash2 size={14} className="mr-2" />} label={t("action.remove")} onClick={() => act("remove")} />
                <MenuItem icon={<Trash size={14} className="mr-2" />} label={t("action.erase")} onClick={() => act("erase")} danger />
                <Divider />
                <MenuItem icon={<FolderOpen size={14} className="mr-2" />} label={t("action.reveal")} onClick={() => act("reveal")} />
                <Divider />
                <MenuItem icon={<Tag size={14} className="mr-2" />} label={t("action.tags")} onClick={() => act("tags")} />
                <MenuItem icon={<FolderInput size={14} className="mr-2" />} label={t("action.relocate")} onClick={() => act("relocate")} hint={gate("relocate")} />
                <MenuItem icon={<Edit3 size={14} className="mr-2" />} label={t("action.rename")} onClick={() => act("rename")} hint={gate("rename")} />
                <Divider />
                <MenuItem icon={<Save size={14} className="mr-2" />} label={t("action.torrentFile")} onClick={() => act("torrentFile")} hint={gate("torrentFile")} />
                <MenuItem icon={<Link2 size={14} className="mr-2" />} label={t("action.magnet")} onClick={() => act("magnet")} />
                <Divider />
                <MenuItem icon={<CheckCircle size={14} className="mr-2" />} label={t("action.verify")} onClick={() => act("verify")} hint={gate("verify")} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
