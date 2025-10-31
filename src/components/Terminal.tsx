import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';
export function Terminal() {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<string[]>(['> Welcome to TorrentX CLI v1.0.3', '> Type "help" for available commands', '>']);
  const terminalEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({
      behavior: 'smooth'
    });
  }, [history]);
  const handleCommand = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && command.trim()) {
      let response: string[] = [];
      switch (command.toLowerCase()) {
        case 'help':
          response = ['Available commands:', '  help         - Show this help message', '  list         - List all torrents', '  add [url]    - Add a new torrent', '  status       - Show download status', '  clear        - Clear terminal', '  exit         - Close terminal'];
          break;
        case 'list':
          response = ['ID | Name | Status | Progress', '----------------------------', '1  | Ubuntu-22.04-LTS-desktop-amd64.iso | downloading | 45%', '2  | Debian-11.3.0-amd64-netinst.iso | seeding | 100%', '3  | Arch-Linux-2023.04.01-x86_64.iso | downloading | 78%', '4  | Kali-Linux-2023.1-live-amd64.iso | seeding | 100%', '5  | FreeBSD-13.1-RELEASE-amd64-dvd1.iso | paused | 32%'];
          break;
        case 'status':
          response = ['Download: 8.2 MB/s | Upload: 3.7 MB/s', 'Active: 2 | Total: 5', 'Ratio: 2.45'];
          break;
        case 'clear':
          setHistory(['> Welcome to TorrentX CLI v1.0.3', '> Type "help" for available commands', '>']);
          setCommand('');
          return;
        case 'exit':
          response = ['Closing terminal...'];
          // Logic to close terminal would be here
          break;
        default:
          if (command.startsWith('add ')) {
            const url = command.substring(4);
            response = [`Adding torrent: ${url}`, 'Torrent added successfully.'];
          } else {
            response = [`Command not found: ${command}`];
          }
      }
      setHistory([...history, `> ${command}`, ...response.map(line => `  ${line}`), '>']);
      setCommand('');
    }
  };
  return <div className="border-t border-green-900/30 bg-black h-64 overflow-y-auto p-4 text-sm font-mono">
      <div className="flex justify-between items-center mb-2">
        <span className="text-green-500 font-semibold">Terminal</span>
        <button className="text-green-500 hover:text-green-400">
          <X size={16} />
        </button>
      </div>
      <div className="text-green-500 space-y-1">
        {history.map((line, index) => <div key={index} className={line.startsWith('>') ? 'text-green-400' : 'text-green-600'}>
            {line}
          </div>)}
        <div className="flex items-center">
          <span className="text-green-400 mr-1">&gt;</span>
          <input type="text" value={command} onChange={e => setCommand(e.target.value)} onKeyDown={handleCommand} className="flex-1 bg-transparent border-none outline-none text-green-400 focus:ring-0" autoFocus />
          <span className="animate-caret-blink text-green-400">▋</span>
        </div>
      </div>
      <div ref={terminalEndRef} />
    </div>;
}