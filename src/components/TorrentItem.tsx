import React, { useEffect, useState, useRef } from 'react';
import { Play, Pause, Trash2, MoreVertical, FolderOpen, FolderInput, Edit3, Save, Link2, CheckCircle, ChevronRight, Trash } from 'lucide-react';
interface Tab {
  id: string;
  name: string;
}
interface TorrentProps {
  torrent: {
    id: number;
    name: string;
    size: string;
    status: string;
    progress: number;
    seeds: number;
    peers: number;
    downloadSpeed: number;
    uploadSpeed: number;
    eta: string;
    added: string;
  };
  isSelected: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  isDragging: boolean;
  tabs: Tab[];
  onMoveToTab: (tabId: string) => void;
}
export function TorrentItem({
  torrent,
  isSelected,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
  tabs,
  onMoveToTab
}: TorrentProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenuOpen, setSubmenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'downloading':
        return 'bg-blue-600';
      case 'seeding':
        return 'bg-green-600';
      case 'paused':
        return 'bg-yellow-600';
      case 'error':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', torrent.id.toString());
    onDragStart();
  };
  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  };
  const handleActionClick = (action: string) => {
    console.log(`Action: ${action} on torrent ${torrent.id}`);
    setMenuOpen(false);
    setSubmenuOpen(false);
    // In a real app, these would trigger actual operations
  };
  const handleMoveToTab = (tabId: string) => {
    onMoveToTab(tabId);
    setMenuOpen(false);
    setSubmenuOpen(false);
  };
  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node) && submenuRef.current && !submenuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setSubmenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [menuOpen]);
  const isDownloading = torrent.status === 'downloading';
  const isPaused = torrent.status === 'paused';
  return <div draggable onDragStart={handleDragStart} onDragEnd={onDragEnd} className={`px-4 py-3 transition-colors duration-200 cursor-pointer ${isSelected ? 'bg-green-900/20 hover:bg-green-900/30' : 'hover:bg-gray-900/70'} ${isDragging ? 'opacity-50' : ''} group relative`} onClick={onClick}>
      <div className="flex items-center text-sm text-green-400">
        <div className="flex-1 px-2 truncate">
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(torrent.status)}`}></div>
            <span className="truncate">{torrent.name}</span>
          </div>
        </div>
        <div className="w-20 text-right px-2">{torrent.size}</div>
        <div className="w-24 text-right px-2">
          <div className="w-full bg-gray-800 rounded-full h-1.5">
            <div className={`h-1.5 rounded-full ${getStatusColor(torrent.status)} transition-all duration-300`} style={{
            width: `${torrent.progress}%`
          }}></div>
          </div>
          <span className="text-xs mt-1 inline-block">{torrent.progress}%</span>
        </div>
        <div className="w-20 text-right px-2">{torrent.seeds}</div>
        <div className="w-20 text-right px-2">{torrent.peers}</div>
        <div className="w-24 text-right px-2">
          {torrent.downloadSpeed > 0 ? `${torrent.downloadSpeed} MB/s` : '-'}
        </div>
        <div className="w-24 text-right px-2">
          {torrent.uploadSpeed > 0 ? `${torrent.uploadSpeed} MB/s` : '-'}
        </div>
        <div className="w-20 text-right px-2">{torrent.eta}</div>
        <div className="hidden group-hover:flex items-center space-x-1 ml-2 absolute right-4 bg-gray-950/80 px-2 py-1 rounded-md shadow-lg backdrop-blur-sm transition-opacity duration-200">
          {isDownloading ? <button className="p-1 rounded hover:bg-gray-800 transition-colors" onClick={e => {
          e.stopPropagation();
          handleActionClick('pause');
        }}>
              <Pause size={14} className="text-green-500" />
            </button> : <button className="p-1 rounded hover:bg-gray-800 transition-colors" onClick={e => {
          e.stopPropagation();
          handleActionClick('resume');
        }}>
              <Play size={14} className="text-green-500" />
            </button>}
          <button className="p-1 rounded hover:bg-gray-800 transition-colors" onClick={e => {
          e.stopPropagation();
          handleActionClick('remove');
        }}>
            <Trash2 size={14} className="text-green-500" />
          </button>
          <div className="relative">
            <button className="p-1 rounded hover:bg-gray-800 transition-colors" onClick={handleMenuClick}>
              <MoreVertical size={14} className="text-green-500" />
            </button>
            {menuOpen && <div ref={menuRef} className="absolute right-0 top-full mt-1 w-56 bg-gray-950 border border-green-900/50 rounded-md shadow-xl z-50" onClick={e => e.stopPropagation()}>
                {/* Resume/Pause */}
                {isPaused ? <button onClick={() => handleActionClick('resume')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                    <Play size={14} className="mr-2" />
                    Resume
                  </button> : <button onClick={() => handleActionClick('pause')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                    <Pause size={14} className="mr-2" />
                    Pause
                  </button>}

                <div className="border-t border-green-900/30 my-1"></div>

                {/* Remove actions */}
                <button onClick={() => handleActionClick('remove')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                  <Trash2 size={14} className="mr-2" />
                  Remove
                </button>
                <button onClick={() => handleActionClick('remove-and-erase')} className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-red-900/20 flex items-center">
                  <Trash size={14} className="mr-2" />
                  Remove and Erase Data
                </button>

                <div className="border-t border-green-900/30 my-1"></div>

                {/* File Explorer */}
                <button onClick={() => handleActionClick('show-in-explorer')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                  <FolderOpen size={14} className="mr-2" />
                  Show in File Explorer
                </button>

                <div className="border-t border-green-900/30 my-1"></div>

                {/* Move/Rename actions */}
                <div className="relative" onMouseEnter={() => setSubmenuOpen(true)} onMouseLeave={() => setSubmenuOpen(false)}>
                  <button className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center justify-between">
                    <span className="flex items-center">
                      <FolderInput size={14} className="mr-2" />
                      Move to Tab
                    </span>
                    <ChevronRight size={14} />
                  </button>
                  {submenuOpen && <div ref={submenuRef} className="absolute left-full top-0 ml-1 w-48 bg-gray-950 border border-green-900/50 rounded-md shadow-xl z-50" onClick={e => e.stopPropagation()}>
                      {tabs.map(tab => <button key={tab.id} onClick={() => handleMoveToTab(tab.id)} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20">
                          {tab.name}
                        </button>)}
                    </div>}
                </div>
                <button onClick={() => handleActionClick('move-data')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                  <FolderInput size={14} className="mr-2" />
                  Move Torrent Data to New Folder
                </button>
                <button onClick={() => handleActionClick('rename')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                  <Edit3 size={14} className="mr-2" />
                  Rename Torrent
                </button>

                <div className="border-t border-green-900/30 my-1"></div>

                {/* Save/Copy actions */}
                <button onClick={() => handleActionClick('save-torrent-file')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                  <Save size={14} className="mr-2" />
                  Save Torrent File As
                </button>
                <button onClick={() => handleActionClick('copy-magnet')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                  <Link2 size={14} className="mr-2" />
                  Copy Magnet Link
                </button>

                <div className="border-t border-green-900/30 my-1"></div>

                {/* Verify */}
                <button onClick={() => handleActionClick('verify')} className="w-full px-3 py-2 text-left text-sm text-green-400 hover:bg-green-900/20 flex items-center">
                  <CheckCircle size={14} className="mr-2" />
                  Verify Data
                </button>
              </div>}
          </div>
        </div>
      </div>
    </div>;
}