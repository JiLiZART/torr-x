import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
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
  ChevronRight,
  Trash,
} from "lucide-react";
import type { Tab, Torrent } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { bytes, eta, percent, rate, statusColor } from "../lib/format";
import { TORRENT_DRAG_TYPE } from "./TabBar";

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
  | "verify";

interface TorrentProps {
  torrent: Torrent;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  tabs: Tab[];
  onMoveToTab: (tabId: string | null) => void;
  onAction: (action: TorrentAction) => void;
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

export function TorrentItem({
  torrent,
  isSelected,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
  tabs,
  onMoveToTab,
  onAction,
}: TorrentProps) {
  const { t, gate } = useUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setMenuOpen(false);
    setSubmenuOpen(false);
  };
  const act = (action: TorrentAction) => {
    close();
    onAction(action);
  };

  const handleDragStart = (e: DragEvent) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(TORRENT_DRAG_TYPE, torrent.id);
    e.dataTransfer.setData("text/plain", torrent.name);
    onDragStart();
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

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={`px-4 py-3 transition-colors duration-200 cursor-pointer ${isSelected ? "bg-tx-accent-900/20 hover:bg-tx-accent-900/30" : "hover:bg-tx-surface-900/70"} ${isDragging ? "opacity-50" : ""} group relative`}
      onClick={onClick}
      title={torrent.error ?? undefined}
    >
      <div className="flex items-center text-sm text-tx-accent-400">
        <div className="flex-1 px-2 truncate">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${color}`}></div>
            <span className="truncate">{torrent.name}</span>
          </div>
        </div>
        <div className="w-20 text-right px-2">{bytes(torrent.size)}</div>
        <div className="w-24 text-right px-2">
          <div className="w-full bg-tx-surface-800 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full ${color} transition-all duration-300`}
              style={{ width: `${torrent.progress * 100}%` }}
            ></div>
          </div>
          <span className="text-xs mt-1 inline-block">{percent(torrent.progress)}</span>
        </div>
        <div className="w-20 text-right px-2">{torrent.seeds}</div>
        <div className="w-20 text-right px-2">{torrent.peers}</div>
        <div className="w-24 text-right px-2">{rate(torrent.downloadRate)}</div>
        <div className="w-24 text-right px-2">{rate(torrent.uploadRate)}</div>
        <div className="w-20 text-right px-2">{isPaused ? t("status.paused") : eta(torrent)}</div>
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
                <div className="relative" onMouseEnter={() => setSubmenuOpen(true)} onMouseLeave={() => setSubmenuOpen(false)}>
                  <button
                    className="w-full px-3 py-2 text-left text-sm text-tx-accent-400 hover:bg-tx-accent-900/20 flex items-center justify-between"
                    onClick={() => setSubmenuOpen(!submenuOpen)}
                  >
                    <span className="flex items-center">
                      <FolderInput size={14} className="mr-2" />
                      {t("action.moveToTab")}
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  {submenuOpen && (
                    <div className="absolute left-full top-0 ml-1 w-48 bg-tx-surface-950 border border-tx-accent-900/50 rounded-md shadow-xl z-50">
                      {tabs.length === 0 && (
                        <div className="px-3 py-2 text-sm text-tx-accent-700">{t("action.noTabs")}</div>
                      )}
                      {tabs.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            close();
                            onMoveToTab(tab.id);
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-tx-accent-900/20 ${tab.torrentIds.includes(torrent.id) ? "text-tx-accent-300" : "text-tx-accent-400"}`}
                        >
                          {tab.name}
                        </button>
                      ))}
                      {tabs.some((tab) => tab.torrentIds.includes(torrent.id)) && (
                        <button
                          onClick={() => {
                            close();
                            onMoveToTab(null);
                          }}
                          className="w-full px-3 py-2 text-left text-sm text-tx-accent-600 hover:bg-tx-accent-900/20 border-t border-tx-accent-900/30"
                        >
                          {t("action.removeFromTab")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
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
