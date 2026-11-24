import { ChevronLeft, ChevronRight, Funnel, LogOut, PanelLeftOpen, Rows3, Settings, SquareTerminal } from "lucide-react";
import { useUi } from "../lib/context";
import { WindowDots } from "./Sidebar";

interface TopBarProps {
  title: string;
  /** Predicates in the active lens; null without a lens. */
  lensCount: number | null;
  sidebarCollapsed: boolean;
  onExpandSidebar: () => void;
  compact: boolean;
  onToggleDensity: () => void;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
  onOpenSettings: () => void;
  onLogout?: () => void;
}

const iconButton = "rounded-md p-1.5 text-tx-accent-500 hover:bg-tx-surface-800";
const on = "bg-tx-accent-900/30 text-tx-accent-400";

// data-tauri-drag-region only applies to the element carrying it, so the empty areas are tagged
// and the controls are not.
export function TopBar({ title, lensCount, sidebarCollapsed, onExpandSidebar, compact, onToggleDensity, terminalOpen, onToggleTerminal, onOpenSettings, onLogout }: TopBarProps) {
  const { t } = useUi();
  return (
    <header data-tauri-drag-region className="flex h-12 shrink-0 items-center gap-2 border-b border-tx-accent-900/30 bg-tx-surface-950 px-3">
      {sidebarCollapsed && (
        <>
          <WindowDots />
          <button className={iconButton} onClick={onExpandSidebar} title={t("sidebar.expand")}>
            <PanelLeftOpen size={16} />
          </button>
        </>
      )}
      <button className={iconButton} onClick={() => window.history.back()} title={t("nav.back")}>
        <ChevronLeft size={16} />
      </button>
      <button className={iconButton} onClick={() => window.history.forward()} title={t("nav.forward")}>
        <ChevronRight size={16} />
      </button>
      <span className="h-4 w-px bg-tx-accent-900/40" />
      <h1 data-tauri-drag-region className="min-w-0 truncate font-bold text-tx-accent-300">
        {title}
      </h1>
      {lensCount !== null && (
        <>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-tx-accent-900/30 px-2 py-0.5 text-[11px] text-tx-accent-400">
            <Funnel size={10} /> {t("top.lens", { n: lensCount })}
          </span>
          <span className="shrink-0 text-[11px] text-tx-accent-700">{t("top.scoped")}</span>
        </>
      )}
      <span data-tauri-drag-region className="flex-1 self-stretch" />
      <button className={`${iconButton} ${compact ? on : ""}`} onClick={onToggleDensity} title={t("top.density")} aria-pressed={compact}>
        <Rows3 size={16} />
      </button>
      <button className={`${iconButton} ${terminalOpen ? on : ""}`} onClick={onToggleTerminal} title={t("header.terminal")} aria-pressed={terminalOpen}>
        <SquareTerminal size={16} />
      </button>
      <button className={iconButton} onClick={onOpenSettings} title={t("header.settings")}>
        <Settings size={16} />
      </button>
      {onLogout && (
        <button className={iconButton} onClick={onLogout} title={t("header.logout")}>
          <LogOut size={16} />
        </button>
      )}
    </header>
  );
}
