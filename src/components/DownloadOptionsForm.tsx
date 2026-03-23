import React from "react";
import { FolderOpen } from "lucide-react";

export interface DownloadOptions {
  downloadPath: string;
  createSubfolder: boolean;
  startTorrent: boolean;
  priority: string;
}

interface DownloadOptionsFormProps {
  options: DownloadOptions;
  onOptionsChange: (updates: Partial<DownloadOptions>) => void;
}

export const DownloadOptionsForm: React.FC<DownloadOptionsFormProps> = ({
  options,
  onOptionsChange,
}) => (
  <div className="border-t border-green-900/30 mt-6 pt-4">
    <h3 className="text-xs font-semibold text-green-700 uppercase tracking-wider mb-3">
      Download Options
    </h3>
    <div className="mb-4">
      <label className="block text-sm text-green-400 mb-1">Save Location</label>
      <div className="flex items-center">
        <input
          type="text"
          value={options.downloadPath}
          onChange={(e) => onOptionsChange({ downloadPath: e.target.value })}
          className="flex-1 bg-gray-900 border border-green-900/50 rounded-l px-3 py-2 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700"
        />
        <button className="bg-green-900/50 hover:bg-green-900/70 text-green-400 py-2 px-3 rounded-r border border-green-900/50 transition-colors">
          <FolderOpen size={14} />
        </button>
      </div>
    </div>
    <div className="space-y-3">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="createSubfolder"
          checked={options.createSubfolder}
          onChange={(e) =>
            onOptionsChange({ createSubfolder: e.target.checked })
          }
          className="h-4 w-4 rounded border-green-900/50 bg-gray-900 checked:bg-green-700 focus:ring-0 focus:ring-offset-0"
        />
        <label
          htmlFor="createSubfolder"
          className="ml-2 text-sm text-green-400"
        >
          Create subfolder for torrent
        </label>
      </div>
      <div className="flex items-center">
        <input
          type="checkbox"
          id="startTorrent"
          checked={options.startTorrent}
          onChange={(e) => onOptionsChange({ startTorrent: e.target.checked })}
          className="h-4 w-4 rounded border-green-900/50 bg-gray-900 checked:bg-green-700 focus:ring-0 focus:ring-offset-0"
        />
        <label htmlFor="startTorrent" className="ml-2 text-sm text-green-400">
          Start torrent immediately
        </label>
      </div>
      <div>
        <label className="block text-sm text-green-400 mb-1">Priority</label>
        <select
          value={options.priority}
          onChange={(e) => onOptionsChange({ priority: e.target.value })}
          className="w-full bg-gray-900 border border-green-900/50 rounded px-3 py-2 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700"
        >
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </div>
    </div>
  </div>
);
