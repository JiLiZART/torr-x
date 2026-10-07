import { Search, Plus, Terminal, Settings, Wifi, LogOut } from "lucide-react";
import { useUi } from "../lib/context";
import { rate } from "../lib/format";
import { closeWindow, isTauri, minimizeWindow, toggleMaximizeWindow } from "../lib/window";

interface HeaderProps {
  toggleTerminal: () => void;
  toggleSettings: () => void;
  toggleAddTorrent: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  downloadRate: number | null;
  onLogout?: () => void;
}

const iconButton = "p-1.5 rounded-md hover:bg-tx-surface-800 text-tx-accent-500";

// data-tauri-drag-region only applies to the element carrying it, so empty areas are tagged and
// buttons/inputs are not; Tauri also toggles maximize on double-click of a drag region.
export function Header({
  toggleTerminal,
  toggleSettings,
  toggleAddTorrent,
  searchQuery,
  setSearchQuery,
  downloadRate,
  onLogout,
}: HeaderProps) {
  const { t } = useUi();
  return (
    <header data-tauri-drag-region className="border-b border-tx-accent-900/30 bg-tx-surface-950 px-4 py-3">
      <div data-tauri-drag-region className="flex items-center justify-between">
        <div data-tauri-drag-region className="flex items-center space-x-2">
          {isTauri() && (
            <div className="flex space-x-1.5 mr-4">
              <button aria-label={t("window.close")} onClick={closeWindow} className="w-3 h-3 bg-red-500 rounded-full" />
              <button aria-label={t("window.minimize")} onClick={minimizeWindow} className="w-3 h-3 bg-yellow-500 rounded-full" />
              <button aria-label={t("window.maximize")} onClick={toggleMaximizeWindow} className="w-3 h-3 bg-green-500 rounded-full" />
            </div>
          )}
          <h1 data-tauri-drag-region className="text-tx-accent-400 font-bold tracking-tight">
            TorrentX
          </h1>
        </div>
        <div data-tauri-drag-region className="flex-1 max-w-md mx-4">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-tx-surface-900 border border-tx-accent-900/50 rounded-md py-1 px-3 pl-8 text-sm text-tx-accent-400 placeholder-tx-accent-700 focus:outline-none focus:ring-1 focus:ring-tx-accent-700"
              placeholder={t("header.search")}
            />
            <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-tx-accent-700 pointer-events-none" />
          </div>
        </div>
        <div data-tauri-drag-region className="flex items-center space-x-3">
          <button className={iconButton} onClick={toggleAddTorrent} title={t("header.add")}>
            <Plus size={18} />
          </button>
          <button className={iconButton} onClick={toggleTerminal} title={t("header.terminal")}>
            <Terminal size={18} />
          </button>
          <button className={iconButton} onClick={toggleSettings} title={t("header.settings")}>
            <Settings size={18} />
          </button>
          {onLogout && (
            <button className={iconButton} onClick={onLogout} title={t("header.logout")}>
              <LogOut size={18} />
            </button>
          )}
          <div data-tauri-drag-region className="flex items-center text-xs text-tx-accent-400 border-l border-tx-accent-900/30 pl-3">
            <Wifi size={14} className="mr-1.5" />
            <span>{downloadRate == null ? "-" : rate(downloadRate)}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
