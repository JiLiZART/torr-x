import { useState, type DragEvent, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, ChevronRight, Ellipsis, Funnel, Hash, PanelLeftClose, Pin, Plus, Save, Search } from "lucide-react";
import type { Stats, Tab, TabPatch } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { bytes, rate } from "../lib/format";
import { sections } from "../lib/lens";
import { ALL_TAB } from "../lib/route";
import { closeWindow, isTauri, minimizeWindow, toggleMaximizeWindow } from "../lib/window";

const TAB_DRAG_TYPE = "application/x-torrentx-tab";

/** Desktop window only: close (hide to tray), minimize, maximize. */
export function WindowDots() {
  const { t } = useUi();
  if (!isTauri()) return null;
  return (
    <div className="flex items-center space-x-1.5">
      <button aria-label={t("window.close")} onClick={closeWindow} className="h-3 w-3 rounded-full bg-red-500" />
      <button aria-label={t("window.minimize")} onClick={minimizeWindow} className="h-3 w-3 rounded-full bg-yellow-500" />
      <button aria-label={t("window.maximize")} onClick={toggleMaximizeWindow} className="h-3 w-3 rounded-full bg-green-500" />
    </div>
  );
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
}

const menuItem = "block w-full px-3 py-1.5 text-left text-xs text-tx-accent-400 hover:bg-tx-accent-900/20";
const inlineInput =
  "w-full min-w-0 rounded border border-tx-accent-900/50 bg-tx-surface-900 px-1.5 py-0.5 text-sm text-tx-accent-400 focus:outline-none focus:ring-1 focus:ring-tx-accent-700";

function SidebarTab({ tab, active, count, error, lensCount, menuOpen, onMenu, onActivate, onPatch, onDelete }: SidebarTabProps) {
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
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "F2") edit("name");
    else if (e.key === "Delete" && tab.id !== ALL_TAB) remove();
    else if (e.altKey && e.key === "ArrowUp") onPatch(tab.id, { order: Math.max(tab.order - 1, 0) });
    else if (e.altKey && e.key === "ArrowDown") onPatch(tab.id, { order: tab.order + 1 });
    else return;
    e.preventDefault();
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
      <div className="flex items-center gap-2 rounded-md bg-red-950/40 px-2 py-1.5 text-xs text-red-300">
        <span className="min-w-0 flex-1 truncate">{t("tabs.confirmDelete", { name: label })}</span>
        <button className="underline" onClick={() => onDelete(tab.id)} autoFocus>
          {t("tabs.delete")}
        </button>
        <button onClick={() => setConfirming(false)}>{t("common.cancel")}</button>
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
      className={`group relative flex items-center rounded-md border text-sm ${active ? "border-tx-accent-900/50 bg-tx-accent-900/20 text-tx-accent-300" : "border-transparent text-tx-accent-500 hover:bg-tx-surface-900"} ${dropTarget ? "ring-1 ring-tx-accent-500" : ""}`}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-tx-accent-500 rounded-md"
        aria-current={active ? "page" : undefined}
        title={error ?? (tab.name ? tab.query : undefined)}
        onClick={() => onActivate(tab.id)}
        onDoubleClick={() => edit("name")}
        onKeyDown={handleKeyDown}
      >
        {error ? (
          <AlertTriangle size={13} className="shrink-0 text-red-400" />
        ) : tab.pinned ? (
          <Pin size={13} className="shrink-0 text-tx-accent-600" />
        ) : (
          <Hash size={13} className="shrink-0 text-tx-accent-700" />
        )}
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {lensCount !== null && (
          <span className="flex items-center gap-0.5 rounded-full bg-tx-accent-900/40 px-1.5 text-[10px] text-tx-accent-400" title={t("tabs.lensBadge", { n: lensCount })}>
            <Funnel size={9} /> {lensCount}
          </span>
        )}
        <span className="text-xs tabular-nums text-tx-accent-700">{error ? "!" : count}</span>
      </button>
      <button
        aria-label={t("tabs.menu")}
        aria-expanded={menuOpen}
        onClick={() => onMenu(!menuOpen)}
        className={`px-1 text-tx-accent-600 hover:text-tx-accent-400 ${menuOpen ? "" : "opacity-0 focus:opacity-100 group-hover:opacity-100"}`}
      >
        <Ellipsis size={14} />
      </button>
      {menuOpen && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-label={t("common.close")} onClick={() => onMenu(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-40 rounded-md border border-tx-accent-900/50 bg-tx-surface-950 py-1 shadow-xl">
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
              <button className={`${menuItem} text-red-400`} onClick={remove}>
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
  onCollapse: () => void;
}

const sectionLabel = "px-2 pb-1 pt-3 text-[10px] font-semibold tracking-wider text-tx-accent-700";
const footButton = "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs";

export function Sidebar({ tabs, activeId, counts, errors, lensCount, stats, onCreate, onTrigger, onSaveLens, onCollapse, ...actions }: SidebarProps) {
  const { t } = useUi();
  const [menuId, setMenuId] = useState<string | null>(null);
  const [closedGroups, setClosedGroups] = useState<string[]>([]);
  const { pinned, smart, groups, adhoc } = sections(tabs);

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
        {...actions}
      />
    ));
  const toggleGroup = (name: string) =>
    setClosedGroups((closed) => (closed.includes(name) ? closed.filter((g) => g !== name) : [...closed, name]));

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-tx-accent-900/30 bg-tx-surface-950 px-2 py-3">
      {/* Empty areas drag the window; Tauri toggles maximize on double-click of a drag region. */}
      <div data-tauri-drag-region className="flex h-5 items-center justify-between px-1">
        <WindowDots />
        <span data-tauri-drag-region className="flex-1 self-stretch" />
        <button onClick={onCollapse} title={t("sidebar.collapse")} className="text-tx-accent-700 hover:text-tx-accent-400">
          <PanelLeftClose size={15} />
        </button>
      </div>
      <button onClick={onTrigger} className="mt-3 flex items-center gap-2 rounded-md bg-tx-surface-900 px-2 py-2 text-xs text-tx-accent-700 hover:text-tx-accent-500">
        <Search size={13} />
        <span className="flex-1 text-left">{t("sidebar.trigger")}</span>
        <kbd>⌘T</kbd>
      </button>
      <nav className="mt-1 flex-1 space-y-0.5 overflow-y-auto" aria-label={t("sidebar.tabs")}>
        <div className={sectionLabel}>{t("sidebar.pinned")}</div>
        {render(pinned)}
        <div className={sectionLabel}>{t("sidebar.smart")}</div>
        {render(smart)}
        {groups.map((group) => {
          const open = !closedGroups.includes(group.name);
          return (
            <div key={group.name}>
              <button onClick={() => toggleGroup(group.name)} aria-expanded={open} className="flex w-full items-center gap-1.5 px-2 pb-1 pt-2 text-[10px] font-semibold tracking-wider text-tx-accent-700 hover:text-tx-accent-500">
                {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="flex-1 text-left">{group.name}</span>
              </button>
              {open && <div className="space-y-0.5 pl-2.5">{render(group.tabs)}</div>}
            </div>
          );
        })}
        {adhoc.length > 0 && <div className={sectionLabel}>{t("sidebar.adhoc")}</div>}
        {render(adhoc)}
      </nav>
      <div className="space-y-1 pt-2">
        <button onClick={onCreate} className={`${footButton} text-tx-accent-500 hover:bg-tx-surface-900`}>
          <Plus size={13} />
          <span className="flex-1 text-left">{t("sidebar.newTab")}</span>
          <kbd className="text-tx-accent-700">⌘⇧T</kbd>
        </button>
        {onSaveLens && (
          <button onClick={onSaveLens} className={`${footButton} bg-tx-accent-900/30 text-tx-accent-400 hover:bg-tx-accent-900/50`}>
            <Save size={13} />
            <span className="flex-1 text-left">{t("sidebar.saveLens")}</span>
            <kbd className="text-tx-accent-600">⌘S</kbd>
          </button>
        )}
        <div
          className="flex gap-3 px-2 pt-2 text-[11px] text-tx-accent-500"
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
          <span className="flex flex-1 items-center gap-1">
            <ArrowDown size={11} className="text-tx-accent-400" /> {stats ? rate(stats.downloadRate).trim() : "-"}
          </span>
          <span className="flex flex-1 items-center gap-1">
            <ArrowUp size={11} className="text-tx-accent-700" /> {stats ? rate(stats.uploadRate).trim() : "-"}
          </span>
        </div>
      </div>
    </aside>
  );
}
