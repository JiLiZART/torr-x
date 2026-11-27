import { cloneElement, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Edit3,
  FolderInput,
  Folder,
  FolderOpen,
  Link2,
  MoreVertical,
  Pause,
  Play,
  Plus,
  Save,
  Tag,
  Trash,
  Trash2,
} from "lucide-react";
import { api, type Torrent } from "@torrentx/api-client";
import { useRowCover } from "./detail/useCover";
import { useUi } from "../lib/context";
import { graphPaths, isActive, type Sample } from "../lib/activity";
import { COLUMNS, type Column, type ColumnWidths } from "../lib/columns";
import { age, bytes, percent, rate, rowState, STATE_STYLE } from "../lib/format";
import { COMMAND_FOR_ACTION, type TorrentAction } from "../lib/commands";

interface TorrentProps {
  torrent: Torrent;
  isSelected: boolean;
  /** The keyboard row cursor. */
  isCursor: boolean;
  onClick: (e: ReactMouseEvent) => void;
  onDoubleClick: () => void;
  onAction: (action: TorrentAction) => void;
  /** Dense rows: one line, no secondary line. */
  compact: boolean;
  /** Recent activity; drawn behind the row while downloading or seeding. */
  samples?: Sample[];
  /** Column order, the same as the header's. */
  order: Column[];
  /** Dragged widths, the same as the header's. */
  widths: ColumnWidths;
}

const itemClass = "w-full px-[10px] py-[6px] text-left text-[12px] flex items-center gap-[8px] disabled:opacity-40 disabled:cursor-not-allowed";

function MenuItem({ icon, label, action, onAction, hint, danger }: { icon: ReactNode; label: string; action: TorrentAction; onAction: (a: TorrentAction) => void; hint?: string; danger?: boolean }) {
  return (
    <div title={hint}>
      <button data-command={COMMAND_FOR_ACTION[action]} onClick={() => onAction(action)} disabled={!!hint} className={`${itemClass} ${danger ? "text-ui-red hover:bg-ui-red-soft" : "text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text"}`}>
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

export function TorrentRow({ torrent, isSelected, isCursor, onClick, onDoubleClick, onAction, compact, samples, order, widths }: TorrentProps) {
  const { t, gate } = useUi();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  useRowCover(torrent, rowRef);

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

  const cells: Record<Column, ReactElement<{ style?: CSSProperties }>> = {
    name: (
        <div key="name" className={`${COLUMNS.name} flex flex-col gap-[2px]`}>
          <span className="truncate text-[13px] font-medium text-ui-text" title={torrent.name}>
            {torrent.name}
          </span>
          {!compact && (
            <span className={`truncate font-code text-[10px] ${torrent.status === "error" ? "text-ui-red" : "text-ui-text-3"}`} title={meta}>
              {meta}
            </span>
          )}
        </div>
    ),
    size: (
        <div key="size" className={`${COLUMNS.size} font-code text-[11px] text-ui-text-2`}>{bytes(torrent.size)}</div>
    ),
    progress: (
        <div key="progress" className={`${COLUMNS.progress} flex flex-col gap-[4px]`}>
          <div className="h-[5px] w-full overflow-hidden rounded-[3px] bg-ui-surface-3">
            <div className={`h-[5px] rounded-[3px] ${style.dot}`} style={{ width: `${torrent.progress * 100}%` }} />
          </div>
          {!compact && <span className="font-code text-[10px] text-ui-text-2">{done ? t("row.done") : percent(torrent.progress)}</span>}
        </div>
    ),
    down: (
        <div key="down" className={`${COLUMNS.down} flex items-center justify-end gap-[4px] font-code text-[11px]`}>
          {moving(torrent.downloadRate) ? (
            <>
              <ArrowDown size={11} className="text-ui-accent" />
              <span className="text-ui-text">{rate(torrent.downloadRate).trim()}</span>
            </>
          ) : (
            idle
          )}
        </div>
    ),
    up: (
        <div key="up" className={`${COLUMNS.up} flex items-center justify-end gap-[4px] font-code text-[11px]`}>
          {moving(torrent.uploadRate) ? (
            <>
              <ArrowUp size={11} className="text-ui-cyan" />
              <span className="text-ui-text-2">{rate(torrent.uploadRate).trim()}</span>
            </>
          ) : (
            idle
          )}
        </div>
    ),
    peers: (
        <div key="peers" className={`${COLUMNS.peers} font-code text-[11px] text-ui-text-2`}>{torrent.peers}</div>
    ),
    ratio: (
        <div key="ratio" className={`${COLUMNS.ratio} font-code text-[11px] text-ui-text-2`}>{torrent.ratio == null ? "—" : torrent.ratio.toFixed(2)}</div>
    ),
    state: (
        <div key="state" className={COLUMNS.state}>
          <span className={`inline-block rounded-[6px] px-[7px] py-[3px] font-code text-[10px] ${style.badge}`}>{t(`state.${state}`)}</span>
        </div>
    ),
    tags: (
        <div key="tags"
          data-tags-cell
          className={`${COLUMNS.tags.replace("xl:block", "xl:flex")} group/tags cursor-pointer items-center gap-[4px] overflow-hidden whitespace-nowrap`}
          title={[torrent.category, ...torrent.tags].filter(Boolean).join(", ") || t("action.tags")}
          onClick={(e) => {
            e.stopPropagation();
            onAction("tags");
          }}
        >
          {torrent.category && (
            <span className={`${tagClass} flex items-center gap-[3px] !text-ui-amber`}>
              <Folder size={9} /> {torrent.category}
            </span>
          )}
          {torrent.category === null && torrent.tags.length === 0 && (
            <span className="hidden items-center gap-[3px] font-code text-[10px] text-ui-text-3 group-hover/tags:flex">
              <Plus size={10} /> {t("picker.add")}
            </span>
          )}
          {torrent.tags.slice(0, MAX_TAGS).map((tag) => (
            <span key={tag} className={tagClass}>
              {tag}
            </span>
          ))}
          {torrent.tags.length > MAX_TAGS && <span className={tagClass}>+{torrent.tags.length - MAX_TAGS}</span>}
        </div>
    ),
    tracker: (
        <div key="tracker" className={`${COLUMNS.tracker} truncate font-code text-[11px] text-ui-text-3`} title={torrent.tracker ?? undefined}>
          {torrent.tracker ?? "—"}
        </div>
    ),
  };

  return (
    <div
      ref={rowRef}
      data-row={torrent.id}
      aria-selected={isSelected}
      className={`group relative isolate ${menuOpen ? "z-20" : ""} flex w-full cursor-pointer select-none items-center gap-[10px] rounded-[10px] border px-[10px] ${compact ? "py-[5px]" : "py-[9px]"} ${isSelected ? "bg-ui-surface-2" : "hover:bg-ui-surface"} ${isCursor ? "border-ui-border-strong" : isSelected ? "border-ui-border" : "border-transparent"}`}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {torrent.cover && (
        // The cover, dimmed with the background the row has in each state so the cells keep their contrast.
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[10px]">
          <img src={api.coverUrl(torrent.id, torrent.cover)} alt="" loading="lazy" className="h-full w-full object-cover" />
          <div className={`absolute inset-0 ${isSelected ? "bg-ui-surface-2/80" : "bg-ui-bg/80 group-hover:bg-ui-surface/80"}`} />
        </div>
      )}
      {graph && (
        <svg className="pointer-events-none absolute inset-0 -z-10 h-full w-full overflow-hidden rounded-[10px]" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <path d={graph.down} className="fill-ui-accent/5" />
          <path d={graph.up} className="fill-none stroke-ui-cyan/30" vectorEffect="non-scaling-stroke" />
        </svg>
      )}
      <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${style.dot}`} />
      {order.map((column) => (widths[column] ? cloneElement(cells[column], { style: { width: widths[column], overflow: "hidden", textOverflow: "ellipsis" } }) : cells[column]))}
      {/* Quick actions float over the row's right end; data columns never move. */}
      <div
        className={`${menuOpen ? "flex" : "hidden group-hover:flex"} absolute right-[10px] items-center gap-[2px] rounded-[8px] border border-ui-border bg-ui-surface px-[4px] py-[3px] shadow-lg`}
        onClick={(e) => e.stopPropagation()}
      >
        <button data-command={isPaused ? "sel.resume" : "sel.pause"} className="rounded-[6px] p-[5px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text" title={isPaused ? t("action.resume") : t("action.pause")} onClick={() => onAction(isPaused ? "resume" : "pause")}>
          {isPaused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button data-command="sel.remove" className="rounded-[6px] p-[5px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text" title={t("action.remove")} onClick={() => onAction("remove")}>
          <Trash2 size={14} />
        </button>
        <div className="relative" ref={menuRef}>
          <button className="rounded-[6px] p-[5px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text" onClick={() => setMenuOpen(!menuOpen)}>
            <MoreVertical size={14} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-[4px] w-[240px] overflow-hidden rounded-[10px] border border-ui-border-strong bg-ui-surface py-[4px] shadow-xl">
              {isPaused ? (
                <MenuItem icon={<Play size={14} />} label={t("action.resume")} action="resume" onAction={act} />
              ) : (
                <MenuItem icon={<Pause size={14} />} label={t("action.pause")} action="pause" onAction={act} />
              )}
              <Divider />
              <MenuItem icon={<Trash2 size={14} />} label={t("action.remove")} action="remove" onAction={act} />
              <MenuItem icon={<Trash size={14} />} label={t("action.erase")} action="erase" onAction={act} danger />
              <Divider />
              <MenuItem icon={<FolderOpen size={14} />} label={t("action.reveal")} action="reveal" onAction={act} />
              <MenuItem icon={<Tag size={14} />} label={t("action.tags")} action="tags" onAction={act} />
              <MenuItem icon={<FolderInput size={14} />} label={t("action.relocate")} action="relocate" onAction={act} hint={gate("relocate")} />
              <MenuItem icon={<Edit3 size={14} />} label={t("action.rename")} action="rename" onAction={act} hint={gate("rename")} />
              <Divider />
              <MenuItem icon={<Save size={14} />} label={t("action.torrentFile")} action="torrentFile" onAction={act} hint={gate("torrentFile")} />
              <MenuItem icon={<Link2 size={14} />} label={t("action.magnet")} action="magnet" onAction={act} />
              <Divider />
              <MenuItem icon={<CheckCircle size={14} />} label={t("action.verify")} action="verify" onAction={act} hint={gate("verify")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
