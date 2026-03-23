import { ArrowDown, ArrowUp, HardDrive, Cpu } from "lucide-react";

export interface StatusBarProps {
  downloadSpeed: string;
  uploadSpeed: string;
  ratio: number;
  freeSpace: string;
  cpuUsage: string;
  memoryUsage: string;
  torrentCount: number;
  activeCount: number;
}

export function StatusBar({
  downloadSpeed,
  uploadSpeed,
  ratio,
  freeSpace,
  cpuUsage,
  memoryUsage,
  torrentCount,
  activeCount,
}: StatusBarProps) {
  return (
    <div className="border-t border-green-900/30 bg-gray-950 py-1 px-4 text-xs text-green-600 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <ArrowDown size={12} className="mr-1 text-green-500" />
          <span>{downloadSpeed}</span>
        </div>
        <div className="flex items-center">
          <ArrowUp size={12} className="mr-1 text-green-500" />
          <span>{uploadSpeed}</span>
        </div>
        <div>
          <span>Ratio: {ratio.toFixed(2)}</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <HardDrive size={12} className="mr-1 text-green-500" />
          <span>{freeSpace}</span>
        </div>
        <div className="flex items-center">
          <Cpu size={12} className="mr-1 text-green-500" />
          <span>CPU: {cpuUsage}</span>
        </div>
        <div>
          <span>MEM: {memoryUsage}</span>
        </div>
        <div>
          <span>
            {torrentCount} torrents • {activeCount} active
          </span>
        </div>
      </div>
    </div>
  );
}
