import { LogOut, Plus, Search, Settings } from "lucide-react";

interface HeaderProps {
  search: string;
  setSearch: (q: string) => void;
  onAdd: () => void;
  onSettings: () => void;
  onLogout?: () => void;
}

const iconButton = "p-1.5 rounded-md hover:bg-gray-800 text-green-500";

export function Header({ search, setSearch, onAdd, onSettings, onLogout }: HeaderProps) {
  return (
    <header className="border-b border-green-900/30 bg-gray-950 px-4 py-3">
      <div className="flex items-center justify-between">
        <h1 className="text-green-400 font-bold tracking-tight">
          <span className="text-green-700">&gt;</span> TorrentX
        </h1>
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-green-900/50 rounded-md py-1 px-3 pl-8 text-sm text-green-400 placeholder-green-700 focus:outline-none focus:ring-1 focus:ring-green-700"
              placeholder="Search torrents..."
            />
            <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-green-700" />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className={iconButton} onClick={onAdd} title="Add torrent">
            <Plus size={18} />
          </button>
          <button className={iconButton} onClick={onSettings} title="Settings">
            <Settings size={18} />
          </button>
          {onLogout && (
            <button className={iconButton} onClick={onLogout} title="Log out">
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
