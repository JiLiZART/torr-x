import React, { useMemo, useState } from 'react';
import { TorrentItem } from './TorrentItem';
import { ChevronUp, ChevronDown } from 'lucide-react';
interface Tab {
  id: string;
  name: string;
}
interface Torrent {
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
  hash: string;
  tracker: string;
  path: string;
  pieces: number;
  pieceSize: string;
  availability: number;
  wasted: string;
  uploaded: string;
  ratio: number;
  priority: string;
  createdBy: string;
  comment: string;
  dateCreated: string;
  tabId?: string;
}
interface TorrentListProps {
  activeTabId: string;
  onSelectTorrent: (torrent: any) => void;
  selectedTorrentId: number | null;
  searchQuery: string;
  onMoveToTab: (torrentId: number, tabId: string) => void;
  tabs: Tab[];
}
type SortColumn = 'name' | 'size' | 'progress' | 'seeds' | 'peers' | 'download' | 'upload' | 'eta';
type SortDirection = 'asc' | 'desc';
export function TorrentList({
  activeTabId,
  onSelectTorrent,
  selectedTorrentId,
  searchQuery,
  onMoveToTab,
  tabs
}: TorrentListProps) {
  const [draggingTorrentId, setDraggingTorrentId] = useState<number | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Mock data for torrents with tabId
  const [torrents, setTorrents] = useState<Torrent[]>([{
    id: 1,
    name: 'Ubuntu-22.04-LTS-desktop-amd64.iso',
    size: '3.8 GB',
    status: 'downloading',
    progress: 45,
    seeds: 1250,
    peers: 362,
    downloadSpeed: 2.8,
    uploadSpeed: 0.5,
    eta: '1h 23m',
    added: '2023-05-15',
    hash: '8f4e7d6c5b3a2f1e0d9c8b7a6',
    tracker: 'udp://tracker.ubuntu.com:6969',
    path: '/downloads/ubuntu',
    pieces: 1024,
    pieceSize: '4 MB',
    availability: 1.5,
    wasted: '45 MB',
    uploaded: '245 MB',
    ratio: 0.14,
    priority: 'normal',
    createdBy: 'Ubuntu Release Team',
    comment: 'Official Ubuntu 22.04 LTS Desktop ISO',
    dateCreated: '2023-04-20',
    tabId: 'downloading'
  }, {
    id: 2,
    name: 'Debian-11.3.0-amd64-netinst.iso',
    size: '392 MB',
    status: 'seeding',
    progress: 100,
    seeds: 47,
    peers: 12,
    downloadSpeed: 0,
    uploadSpeed: 1.2,
    eta: '-',
    added: '2023-04-28',
    hash: '1a2b3c4d5e6f7g8h9i0j',
    tracker: 'udp://tracker.debian.org:6969',
    path: '/downloads/debian',
    pieces: 512,
    pieceSize: '1 MB',
    availability: 3.2,
    wasted: '0 MB',
    uploaded: '4.7 GB',
    ratio: 12.3,
    priority: 'normal',
    createdBy: 'Debian Release Team',
    comment: 'Official Debian 11.3 Net Installer',
    dateCreated: '2023-03-15',
    tabId: 'completed'
  }, {
    id: 3,
    name: 'Arch-Linux-2023.04.01-x86_64.iso',
    size: '786 MB',
    status: 'downloading',
    progress: 78,
    seeds: 523,
    peers: 215,
    downloadSpeed: 5.4,
    uploadSpeed: 0.8,
    eta: '24m',
    added: '2023-05-18',
    hash: 'a1b2c3d4e5f6g7h8i9j0',
    tracker: 'udp://tracker.archlinux.org:6969',
    path: '/downloads/arch',
    pieces: 768,
    pieceSize: '2 MB',
    availability: 4.7,
    wasted: '23 MB',
    uploaded: '120 MB',
    ratio: 0.2,
    priority: 'high',
    createdBy: 'Arch Linux Team',
    comment: 'Arch Linux 2023.04.01 Release',
    dateCreated: '2023-04-01',
    tabId: 'downloading'
  }, {
    id: 4,
    name: 'Kali-Linux-2023.1-live-amd64.iso',
    size: '4.2 GB',
    status: 'seeding',
    progress: 100,
    seeds: 62,
    peers: 27,
    downloadSpeed: 0,
    uploadSpeed: 2.1,
    eta: '-',
    added: '2023-03-10',
    hash: 'k1l2m3n4o5p6q7r8s9t0',
    tracker: 'udp://tracker.kali.org:6969',
    path: '/downloads/kali',
    pieces: 2048,
    pieceSize: '2 MB',
    availability: 1.8,
    wasted: '12 MB',
    uploaded: '12.5 GB',
    ratio: 3.1,
    priority: 'normal',
    createdBy: 'Kali Linux Team',
    comment: 'Official Kali Linux 2023.1 Live ISO',
    dateCreated: '2023-02-15',
    tabId: 'completed'
  }, {
    id: 5,
    name: 'FreeBSD-13.1-RELEASE-amd64-dvd1.iso',
    size: '4.1 GB',
    status: 'paused',
    progress: 32,
    seeds: 85,
    peers: 41,
    downloadSpeed: 0,
    uploadSpeed: 0,
    eta: 'paused',
    added: '2023-05-02',
    hash: 'u1v2w3x4y5z6a7b8c9d0',
    tracker: 'udp://tracker.freebsd.org:6969',
    path: '/downloads/freebsd',
    pieces: 2048,
    pieceSize: '2 MB',
    availability: 2.5,
    wasted: '78 MB',
    uploaded: '320 MB',
    ratio: 0.08,
    priority: 'low',
    createdBy: 'FreeBSD Release Engineering',
    comment: 'FreeBSD 13.1 DVD ISO',
    dateCreated: '2023-01-10',
    tabId: 'all'
  }]);
  // Helper function to parse size to bytes for sorting
  const parseSizeToBytes = (size: string): number => {
    const match = size.match(/^([\d.]+)\s*(GB|MB|KB|B)$/i);
    if (!match) return 0;
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    switch (unit) {
      case 'GB':
        return value * 1024 * 1024 * 1024;
      case 'MB':
        return value * 1024 * 1024;
      case 'KB':
        return value * 1024;
      case 'B':
        return value;
      default:
        return 0;
    }
  };
  // Helper function to parse ETA to minutes for sorting
  const parseEtaToMinutes = (eta: string): number => {
    if (eta === '-') return Infinity;
    if (eta === 'paused') return Infinity;
    const match = eta.match(/^(\d+)h\s*(\d+)m$/);
    if (match) {
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    const minutesMatch = eta.match(/^(\d+)m$/);
    if (minutesMatch) {
      return parseInt(minutesMatch[1]);
    }
    return Infinity;
  };
  // Handle column header click
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };
  // Filter and sort torrents
  const filteredAndSortedTorrents = useMemo(() => {
    // First filter
    let filtered = torrents.filter(torrent => {
      // Filter by tab
      if (activeTabId === 'all') {
        // Show all torrents
      } else if (activeTabId === 'downloading') {
        if (torrent.status !== 'downloading') return false;
      } else if (activeTabId === 'completed') {
        if (torrent.progress !== 100) return false;
      } else {
        // Custom tab - filter by tabId
        if (torrent.tabId !== activeTabId) return false;
      }
      // Filter by search query
      if (searchQuery.trim() !== '') {
        return torrent.name.toLowerCase().includes(searchQuery.toLowerCase());
      }
      return true;
    });
    // Then sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortColumn) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'size':
          comparison = parseSizeToBytes(a.size) - parseSizeToBytes(b.size);
          break;
        case 'progress':
          comparison = a.progress - b.progress;
          break;
        case 'seeds':
          comparison = a.seeds - b.seeds;
          break;
        case 'peers':
          comparison = a.peers - b.peers;
          break;
        case 'download':
          comparison = a.downloadSpeed - b.downloadSpeed;
          break;
        case 'upload':
          comparison = a.uploadSpeed - b.uploadSpeed;
          break;
        case 'eta':
          comparison = parseEtaToMinutes(a.eta) - parseEtaToMinutes(b.eta);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    return filtered;
  }, [torrents, activeTabId, searchQuery, sortColumn, sortDirection]);
  const handleSelectTorrent = (torrent: any) => {
    onSelectTorrent(selectedTorrentId === torrent.id ? null : torrent);
  };
  const handleDragStart = (torrentId: number) => {
    setDraggingTorrentId(torrentId);
  };
  const handleDragEnd = () => {
    setDraggingTorrentId(null);
  };
  const handleDrop = (targetTabId: string) => {
    if (draggingTorrentId !== null) {
      // Update torrent's tabId
      setTorrents(torrents.map(t => t.id === draggingTorrentId ? {
        ...t,
        tabId: targetTabId
      } : t));
      onMoveToTab(draggingTorrentId, targetTabId);
    }
  };
  const handleMoveToTab = (torrentId: number, tabId: string) => {
    setTorrents(torrents.map(t => t.id === torrentId ? {
      ...t,
      tabId: tabId
    } : t));
    onMoveToTab(torrentId, tabId);
  };
  // Render sort indicator
  const renderSortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return null;
    return sortDirection === 'asc' ? <ChevronUp size={14} className="inline ml-1" /> : <ChevronDown size={14} className="inline ml-1" />;
  };
  return <div className="flex-1 overflow-auto">
      <div className="px-4 py-2 border-b border-green-900/30 bg-gray-950 flex text-xs text-green-600 font-semibold">
        <button onClick={() => handleSort('name')} className="flex-1 px-2 text-left hover:text-green-400 transition-colors">
          NAME {renderSortIndicator('name')}
        </button>
        <button onClick={() => handleSort('size')} className="w-20 text-right px-2 hover:text-green-400 transition-colors">
          SIZE {renderSortIndicator('size')}
        </button>
        <button onClick={() => handleSort('progress')} className="w-24 text-right px-2 hover:text-green-400 transition-colors">
          PROGRESS {renderSortIndicator('progress')}
        </button>
        <button onClick={() => handleSort('seeds')} className="w-20 text-right px-2 hover:text-green-400 transition-colors">
          SEEDS {renderSortIndicator('seeds')}
        </button>
        <button onClick={() => handleSort('peers')} className="w-20 text-right px-2 hover:text-green-400 transition-colors">
          PEERS {renderSortIndicator('peers')}
        </button>
        <button onClick={() => handleSort('download')} className="w-24 text-right px-2 hover:text-green-400 transition-colors">
          DOWNLOAD {renderSortIndicator('download')}
        </button>
        <button onClick={() => handleSort('upload')} className="w-24 text-right px-2 hover:text-green-400 transition-colors">
          UPLOAD {renderSortIndicator('upload')}
        </button>
        <button onClick={() => handleSort('eta')} className="w-20 text-right px-2 hover:text-green-400 transition-colors">
          ETA {renderSortIndicator('eta')}
        </button>
      </div>
      <div className="divide-y divide-green-900/20">
        {filteredAndSortedTorrents.map(torrent => <TorrentItem key={torrent.id} torrent={torrent} isSelected={selectedTorrentId === torrent.id} onClick={() => handleSelectTorrent(torrent)} onDragStart={() => handleDragStart(torrent.id)} onDragEnd={handleDragEnd} isDragging={draggingTorrentId === torrent.id} tabs={tabs} onMoveToTab={tabId => handleMoveToTab(torrent.id, tabId)} />)}
        {filteredAndSortedTorrents.length === 0 && <div className="flex flex-col items-center justify-center h-64 text-green-700">
            <div className="text-center mb-4">
              <pre className="text-xs">
                {`  _______                         _       
 |__   __|                       | |      
    | | ___  _ __ _ __ ___ _ __ | |_ ___ 
    | |/ _ \\| '__| '__/ _ \\ '_ \\| __/ __|
    | | (_) | |  | | |  __/ | | | |_\\__ \\
    |_|\\___/|_|  |_|  \\___|_| |_|\\__|___/
`}
              </pre>
            </div>
            <p>
              No torrents found in this tab
              {searchQuery ? ` matching "${searchQuery}"` : ''}.
            </p>
          </div>}
      </div>
    </div>;
}