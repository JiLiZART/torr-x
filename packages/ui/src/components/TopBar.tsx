import {
    ChevronLeft,
    ChevronRight,
    Funnel,
    ListFilter,
    LogOut,
    PanelLeftClose,
    PanelLeftOpen,
    Rows3,
    Settings,
    SquareTerminal
} from "lucide-react";
import { useUi } from "../lib/context";
import { WindowDotsSpace } from "./Sidebar";

interface TopBarProps {
  title: string;
  /** Predicates in the active lens; null without a lens. */
  lensCount: number | null;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  onCollapseSidebar: () => void;
  compact: boolean;
  onToggleDensity: () => void;
  filterBarOpen: boolean;
  onToggleFilterBar: () => void;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
}

const nav = "rounded-[7px] p-[6px] text-ui-text-2 hover:bg-ui-surface-2";
const action = "rounded-[8px] border p-[7px]";
const off = "border-transparent text-ui-text-2 hover:bg-ui-surface-2";
const on = "border-ui-accent-line bg-ui-accent-soft text-ui-accent";

// data-tauri-drag-region only applies to the element carrying it, so the empty areas are tagged
// and the controls are not.
export function TopBar({ title, lensCount, sidebarCollapsed, onExpandSidebar, onCollapseSidebar, compact, onToggleDensity, filterBarOpen, onToggleFilterBar, terminalOpen, onToggleTerminal, onOpenSettings, onLogout }: TopBarProps) {
  const { t } = useUi();
  return (
    <header data-tauri-drag-region className="flex h-[54px] shrink-0 items-center gap-[10px] border-b border-ui-border px-[14px]">
      {sidebarCollapsed ? (
        <>
          <WindowDotsSpace />
          <button data-command="sidebar.toggle" className={nav} onClick={onExpandSidebar} title={t("sidebar.expand")}>
            <PanelLeftOpen size={16} />
          </button>
        </>
      ) : (
          <button data-command="sidebar.toggle" onClick={onCollapseSidebar} title={t("sidebar.collapse")} className="text-ui-text-3 hover:text-ui-text">
              <PanelLeftClose size={15} />
          </button>
      )}
      <div className="flex items-center gap-[2px]">
        <button data-command="nav.back" className={nav} onClick={() => window.history.back()} title={t("nav.back")}>
          <ChevronLeft size={16} />
        </button>
        <button data-command="nav.forward" className={nav} onClick={() => window.history.forward()} title={t("nav.forward")}>
          <ChevronRight size={16} />
        </button>
      </div>
      <span className="h-[18px] w-px bg-ui-border" />
      <h1 data-tauri-drag-region className="min-w-0 truncate text-[15px] font-semibold text-ui-text">
        {title}
      </h1>
      {lensCount !== null && (
        <>
          <span className="flex shrink-0 items-center gap-[5px] rounded-full border border-ui-accent-line bg-ui-accent-soft px-[8px] py-[3px] font-code text-[10px] text-ui-accent">
            <Funnel size={10} /> {t("top.lens", { n: lensCount })}
          </span>
          <span className="shrink-0 font-code text-[10px] text-ui-text-3">{t("top.scoped")}</span>
        </>
      )}
      <span data-tauri-drag-region className="flex-1 self-stretch" />
      <div className="flex items-center gap-[4px]">
        <button data-command="filterBar.toggle" className={`${action} ${filterBarOpen ? on : off}`} onClick={onToggleFilterBar} title={t("cmd.filterBar.toggle")} aria-pressed={filterBarOpen}>
          <ListFilter size={16} />
        </button>
        <button data-command="density.toggle" className={`${action} ${compact ? on : off}`} onClick={onToggleDensity} title={t("top.density")} aria-pressed={compact}>
          <Rows3 size={16} />
        </button>
        <button data-command="terminal.toggle" className={`${action} ${terminalOpen ? on : off}`} onClick={onToggleTerminal} title={t("header.terminal")} aria-pressed={terminalOpen}>
          <SquareTerminal size={16} />
        </button>
        <button data-command="settings.open" className={`${action} ${off}`} onClick={onOpenSettings} title={t("header.settings")}>
          <Settings size={16} />
        </button>
        {onLogout && (
          <button data-command="auth.logout" className="ml-[2px] flex h-[26px] w-[26px] items-center justify-center rounded-full bg-ui-surface-3 text-ui-text-2 hover:text-ui-text" onClick={onLogout} title={t("header.logout")}>
            <LogOut size={12} />
          </button>
        )}
      </div>
    </header>
  );
}
