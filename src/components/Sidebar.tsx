import React from 'react';
import { Download, Upload, Clock, Star, Inbox, HardDrive, Folder, AlertCircle } from 'lucide-react';
interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  isOpen: boolean;
}
export function Sidebar({
  activeView,
  setActiveView,
  isOpen
}: SidebarProps) {
  const navItems = [{
    id: 'all',
    name: 'All Torrents',
    icon: <Inbox size={16} />,
    count: 42
  }, {
    id: 'downloading',
    name: 'Downloading',
    icon: <Download size={16} />,
    count: 5
  }, {
    id: 'seeding',
    name: 'Seeding',
    icon: <Upload size={16} />,
    count: 37
  }, {
    id: 'completed',
    name: 'Completed',
    icon: <Clock size={16} />,
    count: 37
  }, {
    id: 'active',
    name: 'Active',
    icon: <Star size={16} />,
    count: 8
  }, {
    id: 'inactive',
    name: 'Inactive',
    icon: <AlertCircle size={16} />,
    count: 34
  }];
  return <aside className={`border-r border-green-900/30 bg-gray-950 overflow-y-auto transition-all duration-300 ${isOpen ? 'w-56' : 'w-0 opacity-0 overflow-hidden'}`}>
      <div className="px-3 py-4">
        <nav>
          <ul className="space-y-1">
            {navItems.map(item => <li key={item.id}>
                <button onClick={() => setActiveView(item.id)} className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm ${activeView === item.id ? 'bg-green-900/20 text-green-400' : 'text-green-600 hover:bg-gray-900 hover:text-green-500'}`}>
                  <div className="flex items-center">
                    <span className="mr-2">{item.icon}</span>
                    <span>{item.name}</span>
                  </div>
                  <span className="text-xs bg-gray-900 px-1.5 py-0.5 rounded">
                    {item.count}
                  </span>
                </button>
              </li>)}
          </ul>
        </nav>
        <div className="mt-8 space-y-1">
          <h3 className="px-3 text-xs font-semibold text-green-700 uppercase tracking-wider">
            Storage
          </h3>
          <div className="px-3 py-2 text-green-500">
            <div className="flex items-center mb-1">
              <HardDrive size={14} className="mr-2" />
              <span className="text-xs">System (C:)</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-1.5 mt-1">
              <div className="bg-green-600 h-1.5 rounded-full" style={{
              width: '65%'
            }}></div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>650.2 GB</span>
              <span>1 TB</span>
            </div>
          </div>
          <div className="px-3 py-2 text-green-500">
            <div className="flex items-center mb-1">
              <Folder size={14} className="mr-2" />
              <span className="text-xs">Downloads (D:)</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-1.5 mt-1">
              <div className="bg-green-600 h-1.5 rounded-full" style={{
              width: '23%'
            }}></div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>575.5 GB</span>
              <span>2.5 TB</span>
            </div>
          </div>
        </div>
      </div>
    </aside>;
}