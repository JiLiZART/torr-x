import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Edit3,
  FolderInput,
  FolderOpen,
  Link2,
  MoreVertical,
  Pause,
  Play,
  Save,
  Tag,
  Trash,
  Trash2,
} from "lucide-react";
import type { Torrent } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { graphPaths, isActive, type Sample } from "../lib/activity";
import { COLUMNS } from "../lib/columns";
import { age, bytes, percent, rate, rowState, STATE_STYLE } from "../lib/format";

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

const itemClass = "w-full px-[10px] py-[6px] text-left text-[12px] flex items-center gap-[8px] disabled:opacity-40 disabled:cursor-not-allowed";

function MenuItem({ icon, label, onClick, hint, danger }: { icon: ReactNode; label: string; onClick: () => void; hint?: string; danger?: boolean }) {
  return (
    <div title={hint}>
      <button onClick={onClick} disabled={!!hint} className={`${itemClass} ${danger ? "text-ui-red hover:bg-ui-red-soft" : "text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text"}`}>
        {icon}
        {label}
      </button>
    </div>
  );
}

const Divider = () => <div className="my-[4px] border-t border-ui-border" />;
const MAX_TAGS = 2;
const tagClass = "rounded-[5px] border border-ui-border bg-ui-surface-2 px-[6px] py-[2px] font-code text-[10px] text-ui-text-2";
const idle = <span className="text-ui-text-3">—</span>;

export function TorrentRow({ torrent, isSelected, onClick, onAction, compact, samples }: TorrentProps) {
  const { t, gate } = useUi();
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
  const state = rowState(torrent);
  const style = STATE_STYLE[state];
  const graph = isActive(torrent) && samples && samples.length >= 2 ? graphPaths(samples) : null;
  // The state reason replaces the added age while the state needs explaining.
  const reason =
    torrent.status === "error"
      ? (torrent.error ?? t("status.error"))
      : torrent.status === "checking"
        ? t("row.checking")
        : isPaused
          ? t("row.paused")
          : null;
  const meta = [torrent.tracker, reason ?? t("row.added", { when: age(torrent.addedAt) })].filter(Boolean).join(" · ");
  const done = torrent.progress >= 1;
  const moving = (n: number) => n > 0;

  return (
    <div
      className={`group relative isolate flex w-full cursor-pointer items-center gap-[10px] rounded-[10px] border px-[10px] ${compact ? "py-[5px]" : "py-[9px]"} ${isSelected ? "border-ui-border bg-ui-surface-2" : "border-transparent hover:bg-ui-surface"}`}
      onClick={onClick}
    >
      {graph && (
        <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden rounded-[10px]" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={graph.down} className="fill-ui-accent/5" />
          <path d={graph.up} className="fill-none stroke-ui-cyan/30" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${style.dot}`} />
      <div className={`${COLUMNS.name} flex flex-col gap-[2px]`}>
        <span className="truncate text-[13px] font-medium text-ui-text" title={torrent.name}>
          {torrent.name}
        </span>
        {!compact && (
          <span className={`truncate font-code text-[10px] ${torrent.status === "error" ? "text-ui-red" : "text-ui-text-3"}`} title={meta}>
            {meta}
          </span>
        )}
      </div>
      <div className={`${COLUMNS.size} font-code text-[11px] text-ui-text-2`}>{bytes(torrent.size)}</div>
      <div className={`${COLUMNS.progress} flex flex-col gap-[4px]`}>
        <div className="h-[5px] w-full overflow-hidden rounded-[3px] bg-ui-surface-3">
          <div className={`h-[5px] rounded-[3px] ${style.dot}`} style={{ width: `${torrent.progress * 100}%` }} />
        </div>
        {!compact && <span className="font-code text-[10px] text-ui-text-2">{done ? t("row.done") : percent(torrent.progress)}</span>}
      </div>
      <div className={`${COLUMNS.down} flex items-center justify-end gap-[4px] font-code text-[11px]`}>
        {moving(torrent.downloadRate) ? (
          <>
            <ArrowDown size={11} className="text-ui-accent" />
            <span className="text-ui-text">{rate(torrent.downloadRate).trim()}</span>
          </>
        ) : (
          idle
        )}
      </div>
      <div className={`${COLUMNS.up} flex items-center justify-end gap-[4px] font-code text-[11px]`}>
        {moving(torrent.uploadRate) ? (
          <>
            <ArrowUp size={11} className="text-ui-cyan" />
            <span className="text-ui-text-2">{rate(torrent.uploadRate).trim()}</span>
          </>
        ) : (
          idle
        )}
      </div>
      <div className={`${COLUMNS.peers} font-code text-[11px] text-ui-text-2`}>{torrent.peers}</div>
      <div className={`${COLUMNS.ratio} font-code text-[11px] text-ui-text-2`}>{torrent.ratio == null ? "—" : torrent.ratio.toFixed(2)}</div>
      <div className={COLUMNS.state}>
        <span className={`inline-block rounded-[6px] px-[7px] py-[3px] font-code text-[10px] ${style.badge}`}>{t(`state.${state}`)}</span>
      </div>
      <div className={`${COLUMNS.tags} flex items-center gap-[4px] overflow-hidden`} title={torrent.tags.join(", ")}>
        {torrent.tags.slice(0, MAX_TAGS).map((tag) => (
          <span key={tag} className={tagClass}>
            {tag}
          </span>
        ))}
        {torrent.tags.length > MAX_TAGS && <span className={tagClass}>+{torrent.tags.length - MAX_TAGS}</span>}
      </div>
      <div className={`${COLUMNS.tracker} truncate font-code text-[11px] text-ui-text-3`} title={torrent.tracker ?? undefined}>
        {torrent.tracker ?? "—"}
      </div>
      {/* Quick actions float over the tags + tracker cells; data columns never move. */}
      <div
        className={`${menuOpen ? "flex" : "hidden group-hover:flex"} absolute right-[10px] items-center gap-[2px] rounded-[8px] border border-ui-border bg-ui-surface px-[4px] py-[3px] shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="rounded-[6px] p-[5px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text" title={isPaused ? t("action.resume") : t("action.pause")} onClick={() => onAction(isPaused ? "resume" : "pause")}>
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button className="rounded-[6px] p-[5px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text" title={t("action.remove")} onClick={() => onAction("remove")}>
          <Trash2 size={14} />
        </button>
        <div className="relative" ref={menuRef}>
          <button className="rounded-[6px] p-[5px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text" onClick={() => setMenuOpen(!menuOpen)}>
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-[4px] w-[240px] overflow-hidden rounded-[10px] border border-ui-border-strong bg-ui-surface py-[4px] shadow-xl">
              {isPaused ? (
                <MenuItem icon={<Play size={14} />} label={t("action.resume")} onClick={() => act("resume")} />
              ) : (
                <MenuItem icon={<Pause size={14} />} label={t("action.pause")} onClick={() => act("pause")} />
              )}
              <Divider />
              <MenuItem icon={<Trash2 size={14} />} label={t("action.remove")} onClick={() => act("remove")} />
              <MenuItem icon={<Trash size={14} />} label={t("action.erase")} onClick={() => act("erase")} danger />
              <Divider />
              <MenuItem icon={<FolderOpen size={14} />} label={t("action.reveal")} onClick={() => act("reveal")} />
              <MenuItem icon={<Tag size={14} />} label={t("action.tags")} onClick={() => act("tags")} />
              <MenuItem icon={<FolderInput size={14} />} label={t("action.relocate")} onClick={() => act("relocate")} hint={gate("relocate")} />
              <MenuItem icon={<Edit3 size={14} />} label={t("action.rename")} onClick={() => act("rename")} hint={gate("rename")} />
              <Divider />
              <MenuItem icon={<Save size={14} />} label={t("action.torrentFile")} onClick={() => act("torrentFile")} hint={gate("torrentFile")} />
              <MenuItem icon={<Link2 size={14} />} label={t("action.magnet")} onClick={() => act("magnet")} />
              <Divider />
              <MenuItem icon={<CheckCircle size={14} />} label={t("action.verify")} onClick={() => act("verify")} hint={gate("verify")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
