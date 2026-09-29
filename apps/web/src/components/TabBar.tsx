import type { Torrent } from "@torrentx/api-client";
import { FILTERS, matchesFilter, type Filter } from "../lib/filters";

interface TabBarProps {
  torrents: Torrent[];
  filter: Filter;
  onChange: (f: Filter) => void;
}

export function TabBar({ torrents, filter, onChange }: TabBarProps) {
  return (
    <div className="border-b border-green-900/30 bg-gray-950 px-4 py-2 flex items-center space-x-1 overflow-x-auto">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          onClick={() => onChange(f.id)}
          className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
            filter === f.id
              ? "bg-green-900/20 text-green-400"
              : "text-green-600 hover:bg-gray-900 hover:text-green-500"
          }`}
        >
          {f.name}
          <span className="ml-1.5 text-xs text-green-700">
            {torrents.filter((t) => matchesFilter(t, f.id)).length}
          </span>
        </button>
      ))}
    </div>
  );
}
