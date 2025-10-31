import React, { useState } from "react";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import { TorrentList } from "./components/TorrentList";
import { StatusBar } from "./components/StatusBar";
import { Terminal } from "./components/Terminal";
import { TorrentDetails } from "./components/TorrentDetails";
import { Settings } from "./components/Settings";
import { AddTorrent } from "./components/AddTorrent";
interface Tab {
  id: string;
  name: string;
}
export function App() {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: "all",
      name: "All Torrents",
    },
    {
      id: "downloading",
      name: "Downloading",
    },
    {
      id: "completed",
      name: "Completed",
    },
  ]);
  const [activeTabId, setActiveTabId] = useState("all");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addTorrentOpen, setAddTorrentOpen] = useState(false);
  const [selectedTorrent, setSelectedTorrent] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const handleAddTab = () => {
    const newTabNumber = tabs.length + 1;
    const newTab: Tab = {
      id: `tab-${Date.now()}`,
      name: `Tab ${newTabNumber}`,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newTab.id);
  };
  const handleRenameTab = (tabId: string, newName: string) => {
    setTabs(
      tabs.map((tab) => {
        if (tab.id === tabId) {
          // If name is empty, auto-generate name
          const finalName =
            newName.trim() ||
            `Tab ${tabs.findIndex((t) => t.id === tabId) + 1}`;
          return {
            ...tab,
            name: finalName,
          };
        }
        return tab;
      })
    );
  };
  const handleDeleteTab = (tabId: string) => {
    if (tabs.length === 1) return; // Don't delete last tab
    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);
    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id);
    }
  };
  const handleDragOverTab = (tabId: string) => {
    setDragOverTabId(tabId);
  };
  const handleDropOnTab = (tabId: string) => {
    setDragOverTabId(null);
    // Tab change will be handled by TorrentList
  };
  return (
    <div className="flex flex-col w-full min-h-screen border border-green-900/30 rounded-xl bg-black text-green-500 font-mono">
      <Header
        toggleTerminal={() => setTerminalOpen(!terminalOpen)}
        toggleSettings={() => setSettingsOpen(!settingsOpen)}
        toggleAddTorrent={() => setAddTorrentOpen(!addTorrentOpen)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onTabChange={setActiveTabId}
        onAddTab={handleAddTab}
        onRenameTab={handleRenameTab}
        onDeleteTab={handleDeleteTab}
        onDragOver={handleDragOverTab}
        onDrop={handleDropOnTab}
        dragOverTabId={dragOverTabId}
      />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden flex flex-col">
          <TorrentList
            activeTabId={activeTabId}
            onSelectTorrent={setSelectedTorrent}
            selectedTorrentId={selectedTorrent?.id}
            searchQuery={searchQuery}
            onMoveToTab={(torrentId: number, tabId: string) => {
              console.log(`Move torrent ${torrentId} to tab ${tabId}`);
            }}
            tabs={tabs}
          />
          {selectedTorrent && (
            <TorrentDetails
              torrent={selectedTorrent}
              onClose={() => setSelectedTorrent(null)}
            />
          )}
          {terminalOpen && !selectedTorrent && <Terminal />}
        </main>
      </div>
      <StatusBar />
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} />}
      {addTorrentOpen && (
        <AddTorrent onClose={() => setAddTorrentOpen(false)} />
      )}
    </div>
  );
}
