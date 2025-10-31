import React, { useState } from 'react';
import { Search, Plus, Terminal, Settings, Wifi } from 'lucide-react';
interface HeaderProps {
  toggleTerminal: () => void;
  toggleSettings: () => void;
  toggleAddTorrent: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}
export function Header({
  toggleTerminal,
  toggleSettings,
  toggleAddTorrent,
  searchQuery,
  setSearchQuery
}: HeaderProps) {
  return <header className="border-b border-green-900/30 bg-gray-950 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 bg-red-500 rounded-full" />
            <div className="w-3 h-3 bg-yellow-500 rounded-full" />
            <div className="w-3 h-3 bg-green-500 rounded-full" />
          </div>
          <h1 className="text-green-400 font-bold ml-4 tracking-tight">
            TorrentX
          </h1>
        </div>
        <div className="flex-1 max-w-md mx-4">
          <div className="relative">
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-gray-900 border border-green-900/50 rounded-md py-1 px-3 pl-8 text-sm text-green-400 placeholder-green-700 focus:outline-none focus:ring-1 focus:ring-green-700" placeholder="Search torrents..." />
            <Search className="absolute left-2.5 top-1.5 h-4 w-4 text-green-700" />
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button className="p-1.5 rounded-md hover:bg-gray-800 text-green-500" onClick={toggleAddTorrent}>
            <Plus size={18} />
          </button>
          <button className="p-1.5 rounded-md hover:bg-gray-800 text-green-500" onClick={toggleTerminal}>
            <Terminal size={18} />
          </button>
          <button className="p-1.5 rounded-md hover:bg-gray-800 text-green-500" onClick={toggleSettings}>
            <Settings size={18} />
          </button>
          <div className="flex items-center text-xs text-green-400 border-l border-green-900/30 pl-3">
            <Wifi size={14} className="mr-1.5" />
            <span>8.2 MB/s</span>
          </div>
        </div>
      </div>
    </header>;
}