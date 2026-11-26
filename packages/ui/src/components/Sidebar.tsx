import { useEffect, useState, type DragEvent, type KeyboardEvent } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpFromLine,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  CirclePause,
  Clapperboard,
  Disc3,
  Ellipsis,
  Funnel,
  Globe,
  Hash,
  Music,
  Pause,
  Plus,
  RefreshCw,
  Save,
  Search,
  Tv,
  type LucideIcon,
} from "lucide-react";
import type { Stats, Tab, TabPatch } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { bytes, rate } from "../lib/format";
import { sections, tabIcon, type TabIcon } from "../lib/lens";
import { ALL_TAB } from "../lib/route";
import { closeWindow, isTauri, minimizeWindow, toggleMaximizeWindow } from "../lib/window";
import { commandById } from "../lib/commands";
import { IS_MAC, keyCaps, usableKeys } from "../lib/keymap";
import { KeyCaps } from "./KeyCaps";

/** The first binding of a command that works here (browsers reserve ⌘T). */
const bindingOf = (id: string) => usableKeys(commandById(id)?.keys ?? [], isTauri())[0] ?? "";

const TAB_DRAG_TYPE = "application/x-torrentx-tab";

const TAB_ICONS: Record<TabIcon, LucideIcon> = {
  all: Globe,
  downloading: ArrowDownToLine,
  active: Activity,
  seeding: ArrowUpFromLine,
  stalled: Pause,
  paused: CirclePause,
  checking: RefreshCw,
  error: AlertTriangle,
  movies: Clapperboard,
  shows: Tv,
  music: Music,
  books: BookOpen,
  discs: Disc3,
  adhoc: CircleDashed,
  smart: Hash,
};

/**
 * Desktop window only: close (hide to tray), minimize, maximize. Rendered once by the Shell, pinned to
 * the window corner so it never moves when the sidebar collapses; the sidebar head and the top bar
 * reserve its width with `WindowDotsSpace`. The dot colors are the OS's, not the theme's.
 */
export function WindowDots() {
  const { t } = useUi();
  if (!isTauri()) return null;
  const dot = "h-[11px] w-[11px] rounded-full";
  return (
    <div className="absolute left-[14px] top-[21px] z-50 flex h-[12px] items-center gap-[7px]">
      <button aria-label={t("window.close")} onClick={closeWindow} className={`${dot} bg-[#FF5F57]`} />
      <button aria-label={t("window.minimize")} onClick={minimizeWindow} className={`${dot} bg-[#FEBC2E]`} />
      <button aria-label={t("window.maximize")} onClick={toggleMaximizeWindow} className={`${dot} bg-[#28C840]`} />
    </div>
  );
}

/** Empty, draggable room for the pinned window dots (3 × 11px + 2 × 7px). */
export function WindowDotsSpace() {
  return isTauri() ? <span data-tauri-drag-region className="w-[47px] shrink-0 self-stretch" /> : null;
}

interface TabActions {
  onActivate: (id: string) => void;
  onPatch: (id: string, patch: TabPatch) => void;
  onDelete: (id: string) => void;
}

interface SidebarTabProps extends TabActions {
  tab: Tab;
  active: boolean;
  count: number;
  /** Parse error of the tab query. */
  error?: string;
  /** Predicates in this tab's active lens. */
  lensCount: number | null;
  menuOpen: boolean;
  onMenu: (open: boolean) => void;
  /** Bumped by the rename command (F2 anywhere) for the active tab. */
  renameRequest: number;
}

const menuItem = "block w-full px-[10px] py-[6px] text-left text-[12px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text";
const inlineInput =
  "w-full min-w-0 rounded-[8px] border border-ui-accent-line bg-ui-surface px-[9px] py-[6px] text-[13px] font-medium text-ui-text placeholder-ui-text-3 focus:outline-none";

function SidebarTab({ tab, active, count, error, lensCount, menuOpen, onMenu, renameRequest, onActivate, onPatch, onDelete }: SidebarTabProps) {
  const { t } = useUi();
  const [editing, setEditing] = useState<"name" | "group" | null>(null);
  const [value, setValue] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [dropTarget, setDropTarget] = useState(false);

  const label = tab.name || tab.query || t("tabs.untitled");
  const edit = (what: "name" | "group") => {
    onMenu(false);
    setValue(what === "name" ? tab.name : (tab.group ?? ""));
    setEditing(what);
  };
  useEffect(() => {
    if (renameRequest > 0) {
      setValue(tab.name);
      setEditing("name");
    }
  }, [renameRequest, tab.name]);
  const commit = () => {
    if (editing === "name" && value.trim() !== tab.name) onPatch(tab.id, { name: value.trim() });
    if (editing === "group" && value.trim() !== (tab.group ?? "")) onPatch(tab.id, { group: value.trim() || null });
    setEditing(null);
  };
  // More than one predicate is worth a second look before it is gone.
  const remove = () => {
    onMenu(false);
    if (tab.query.trim().split(/\s+/).length > 1) setConfirming(true);
    else onDelete(tab.id);
  };
  // F2 / Delete on a focused tab act on that tab, not the active one; the window keymap must not also fire.
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "F2") edit("name");
    else if (e.key === "Delete" && tab.id !== ALL_TAB) remove();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };
  const handleDrop = (e: DragEvent) => {
    const id = e.dataTransfer.getData(TAB_DRAG_TYPE);
    setDropTarget(false);
    if (!id || id === tab.id) return;
    e.preventDefault();
    onPatch(id, { order: tab.order });
  };

  if (confirming) {
    return (
      <div className="flex items-center gap-[8px] rounded-[8px] border border-ui-red bg-ui-red-soft px-[9px] py-[7px] text-[12px] text-ui-red">
        <span className="min-w-0 flex-1 truncate">{t("tabs.confirmDelete", { name: label })}</span>
        <button className="font-semibold underline" onClick={() => onDelete(tab.id)} autoFocus>
          {t("tabs.delete")}
        </button>
        <button className="text-ui-text-2" onClick={() => setConfirming(false)}>
          {t("common.cancel")}
        </button>
      </div>
    );
  }
  if (editing) {
    return (
      <input
        className={inlineInput}
        value={value}
        autoFocus
        onFocus={(e) => e.target.select()}
        placeholder={editing === "name" ? tab.query || t("tabs.namePlaceholder") : t("tabs.groupPlaceholder")}
        aria-label={editing === "name" ? t("tabs.rename") : t("tabs.group")}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          else if (e.key === "Escape") setEditing(null);
        }}
      />
    );
  }
  // Variants of the canvas `Tab` component: plain, active, active with a lens.
  const frame = active
    ? `bg-ui-surface ${lensCount !== null ? "border-ui-accent-line" : "border-ui-border"}`
    : "border-transparent hover:bg-ui-surface-2";
  const iconColor = error ? "text-ui-red" : active || tab.pinned ? "text-ui-accent" : "text-ui-text-3";
  const Icon = error ? AlertTriangle : TAB_ICONS[tabIcon(tab)];
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData(TAB_DRAG_TYPE, tab.id);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(TAB_DRAG_TYPE)) return;
        e.preventDefault();
        setDropTarget(true);
      }}
      onDragLeave={() => setDropTarget(false)}
      onDrop={handleDrop}
      className={`group relative flex w-full items-center rounded-[8px] border ${frame} ${dropTarget ? "!border-ui-accent" : ""}`}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-[8px] rounded-[8px] px-[9px] py-[7px] text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ui-accent"
        aria-current={active ? "page" : undefined}
        title={error ?? (tab.name ? tab.query : undefined)}
        onClick={() => onActivate(tab.id)}
        onDoubleClick={() => edit("name")}
        onKeyDown={handleKeyDown}
      >
        <Icon size={14} className={`shrink-0 ${iconColor}`} />
        <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${tab.name ? "" : "font-code text-[12px]"} ${active || tab.pinned ? "text-ui-text" : "text-ui-text-2"}`}>
          {label}
        </span>
        <span className={`font-code text-[11px] tabular-nums ${error ? "text-ui-red" : "text-ui-text-3"}`}>{error ? "!" : count}</span>
        {lensCount !== null && (
          <span className="flex items-center gap-[3px] rounded-full bg-ui-accent-soft px-[5px] py-[2px] font-code text-[10px] font-medium text-ui-accent" title={t("tabs.lensBadge", { n: lensCount })}>
            <Funnel size={9} /> {lensCount}
          </span>
        )}
      </button>
      <button
        aria-label={t("tabs.menu")}
        aria-expanded={menuOpen}
        onClick={() => onMenu(!menuOpen)}
        className={`pr-[6px] text-ui-text-3 hover:text-ui-text ${menuOpen ? "" : "hidden focus:block group-hover:block"}`}
      >
        <Ellipsis size={14} />
      </button>
      {menuOpen && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label={t("common.close")} onClick={() => onMenu(false)} />
          <div className="absolute right-0 top-full z-50 mt-[4px] w-[160px] overflow-hidden rounded-[10px] border border-ui-border-strong bg-ui-surface py-[4px] shadow-xl">
            <button className={menuItem} onClick={() => edit("name")}>
              {t("tabs.rename")}
            </button>
            <button
              className={menuItem}
              onClick={() => {
                onMenu(false);
                onPatch(tab.id, { pinned: !tab.pinned });
              }}
            >
              {tab.pinned ? t("tabs.unpin") : t("tabs.pin")}
            </button>
            <button className={menuItem} onClick={() => edit("group")}>
              {t("tabs.group")}
            </button>
            {tab.id !== ALL_TAB && (
              <button className={`${menuItem} !text-ui-red`} onClick={remove}>
                {t("tabs.delete")}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

interface SidebarProps extends TabActions {
  tabs: Tab[];
  activeId: string;
  /** Live match count per tab id. */
  counts: Record<string, number>;
  /** Parse error message per tab id. */
  errors: Record<string, string>;
  /** Predicates in the active tab's lens; null without a lens. */
  lensCount: number | null;
  stats: Stats | null;
  onCreate: () => void;
  onTrigger: () => void;
  /** Null when there is no lens to save. */
  onSaveLens: (() => void) | null;
  /** Rename the active tab in place; bumped per request. */
  renameRequest: number;
}

const sectionLabel = "px-[8px] pb-[4px] pt-[10px] font-code text-[9px] tracking-[1.2px] text-ui-text-3";
const footButton = "flex w-full items-center gap-[7px] rounded-[9px] border px-[9px] py-[8px] text-[12px] font-medium";

export function Sidebar({ tabs, activeId, counts, errors, lensCount, stats, onCreate, onTrigger, onSaveLens, renameRequest, ...actions }: SidebarProps) {
  const { t } = useUi();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const { pinned, smart, groups, adhoc } = sections(tabs);
  const paletteKey = bindingOf("palette.open");
  const newTabKey = bindingOf("tab.new");

  const render = (list: Tab[]) =>
    list.map((tab) => (
      <SidebarTab
        key={tab.id}
        tab={tab}
        active={tab.id === activeId}
        count={counts[tab.id] ?? 0}
        error={errors[tab.id]}
        lensCount={tab.id === activeId ? lensCount : null}
        menuOpen={menuId === tab.id}
        onMenu={(open) => setMenuId(open ? tab.id : null)}
        renameRequest={tab.id === activeId ? renameRequest : 0}
        {...actions}
      />
    ));
  const toggleGroup = (name: string) =>
    setClosedGroups((closed) => (closed.includes(name) ? closed.filter((g) => g !== name) : [...closed, name]));

  return (
    <aside className="flex w-[248px] shrink-0 flex-col gap-[8px] border-r border-ui-border bg-ui-chrome px-[10px] py-[12px]">
      {/* Empty areas drag the window; Tauri toggles maximize on double-click of a drag region. */}
      {/* Same height as the top bar, so the pinned dots sit on one line in both layouts. */}
      <div data-tauri-drag-region="deep" className="-mx-[10px] -mt-[12px] flex h-[54px] select-none shrink-0 items-center gap-[7px] px-[14px]">
        <WindowDotsSpace />
        <span className="flex-1 self-stretch" />
      </div>
      <button data-command="palette.open" onClick={onTrigger} className="flex items-center gap-[8px] rounded-[10px] border border-ui-border bg-ui-surface-2 px-[10px] py-[9px] text-ui-text-3 hover:border-ui-border-strong">
        <Search size={14} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left text-[12px]">{t("sidebar.trigger")}</span>
        {paletteKey && <span className="shrink-0 font-code text-[10px]">{keyCaps(paletteKey, IS_MAC).join(IS_MAC ? "" : "+")}</span>}
      </button>
      <nav className="-mx-[2px] flex min-h-0 flex-1 flex-col gap-[4px] overflow-y-auto px-[2px]" aria-label={t("sidebar.tabs")}>
        <div className={sectionLabel}>{t("sidebar.pinned")}</div>
        {render(pinned)}
        <div className={sectionLabel}>{t("sidebar.smart")}</div>
        {render(smart)}
        {groups.map((group) => {
          const open = !closedGroups.includes(group.name);
          return (
            <div key={group.name} className="flex flex-col gap-[2px]">
              <button onClick={() => toggleGroup(group.name)} aria-expanded={open} className="flex w-full items-center gap-[6px] px-[8px] pb-[4px] pt-[8px] font-code text-[9px] tracking-[1.2px] text-ui-text-3 hover:text-ui-text-2">
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="flex-1 text-left">{group.name}</span>
              </button>
              {open && <div className="flex flex-col gap-[2px] border-l border-ui-border pl-[10px]">{render(group.tabs)}</div>}
            </div>
          );
        })}
        {adhoc.length > 0 && <div className={sectionLabel}>{t("sidebar.adhoc")}</div>}
        {render(adhoc)}
      </nav>
      <div className="flex flex-col gap-[6px]">
        <button data-command="tab.new" onClick={onCreate} className={`${footButton} border-dashed border-ui-border text-ui-text-2 hover:border-ui-border-strong`}>
          <Plus size={13} className="text-ui-text-3" />
          <span className="flex-1 text-left">{t("sidebar.newTab")}</span>
          <KeyCaps binding={newTabKey} tone="text-ui-text-3" />
        </button>
        {onSaveLens && (
          <button data-command="tab.save" onClick={onSaveLens} className={`${footButton} border-ui-accent-line bg-ui-accent-soft text-ui-accent`}>
            <Save size={13} />
            <span className="flex-1 text-left">{t("sidebar.saveLens")}</span>
            <KeyCaps binding="Mod+S" tone="text-ui-accent-line" />
          </button>
        )}
      </div>
      <div
        className="flex items-center gap-[10px] px-[8px] pb-[2px] pt-[10px] font-code text-[10px] text-ui-text-2"
        title={
          stats
            ? [
                t("status.ratio", { ratio: stats.ratio == null ? "-" : stats.ratio.toFixed(2) }),
                t("status.cpu", { cpu: Math.round(stats.cpuPercent) }),
                t("status.mem", { mem: bytes(stats.memoryBytes) }),
              ].join(" · ")
            : undefined
        }
      >
        <span className="flex flex-1 items-center gap-[4px]">
          <ArrowDown size={11} className="text-ui-accent" /> {stats?.downloadRate ? rate(stats.downloadRate).trim() : "—"}
        </span>
        <span className="flex flex-1 items-center gap-[4px]">
          <ArrowUp size={11} className="text-ui-cyan" /> {stats?.uploadRate ? rate(stats.uploadRate).trim() : "—"}
        </span>
      </div>
    </aside>
  );
}
