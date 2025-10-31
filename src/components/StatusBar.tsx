import React from 'react';
import { ArrowDown, ArrowUp, HardDrive, Cpu } from 'lucide-react';
export function StatusBar() {
  return <div className="border-t border-green-900/30 bg-gray-950 py-1 px-4 text-xs text-green-600 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <ArrowDown size={12} className="mr-1 text-green-500" />
          <span>8.2 MB/s</span>
        </div>
        <div className="flex items-center">
          <ArrowUp size={12} className="mr-1 text-green-500" />
          <span>3.7 MB/s</span>
        </div>
        <div>
          <span>Ratio: 2.45</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <HardDrive size={12} className="mr-1 text-green-500" />
          <span>1.2 TB free</span>
        </div>
        <div className="flex items-center">
          <Cpu size={12} className="mr-1 text-green-500" />
          <span>CPU: 12%</span>
        </div>
        <div>
          <span>MEM: 2.8 GB</span>
        </div>
        <div>
          <span>5 torrents • 2 active</span>
        </div>
      </div>
    </div>;
}