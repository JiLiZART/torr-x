import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { useUi } from "../lib/context";

export const TORRENT_DRAG_TYPE = "application/x-torrentx-id";

export interface TabView {
  id: string;
  name: string;
  builtin: boolean;
}

interface TabBarProps {
  tabs: TabView[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onAddTab: () => void;
  /** Empty name means "use the default Tab N". */
  onRenameTab: (tabId: string, newName: string) => void;
  onDeleteTab: (tabId: string) => void;
  onDropTorrent: (tabId: string, torrentId: string) => void;
}

const isTorrentDrag = (e: DragEvent) => e.dataTransfer.types.includes(TORRENT_DRAG_TYPE);

export function TabBar({
  tabs,
  activeTabId,
  onTabChange,
  onAddTab,
  onRenameTab,
  onDeleteTab,
  onDropTorrent,
}: TabBarProps) {
  const { t } = useUi();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const handleStartEdit = (tab: TabView) => {
    if (tab.builtin) return;
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };
  const stopEdit = () => {
    setEditingTabId(null);
    setEditingName("");
  };
  const handleFinishEdit = () => {
    if (!editingTabId) return;
    onRenameTab(editingTabId, editingName.trim());
    stopEdit();
  };
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter") handleFinishEdit();
    else if (e.key === "Escape") stopEdit();
  };
  const handleDragOver = (e: DragEvent, tabId: string) => {
    if (!isTorrentDrag(e)) return;
    e.preventDefault();
    setDragOverTabId(tabId);
  };
  const handleDrop = (e: DragEvent, tab: TabView) => {
    if (!isTorrentDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    setDragOverTabId(null);
    if (!tab.builtin) onDropTorrent(tab.id, e.dataTransfer.getData(TORRENT_DRAG_TYPE));
  };

  return (
    <div className="border-b border-tx-accent-900/30 bg-tx-surface-950 px-4 py-2 flex items-center space-x-1 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onDragOver={(e) => handleDragOver(e, tab.id)}
          onDragLeave={() => setDragOverTabId((id) => (id === tab.id ? null : id))}
          onDrop={(e) => handleDrop(e, tab)}
          className={`relative flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${activeTabId === tab.id ? "bg-tx-accent-900/20 text-tx-accent-400" : "text-tx-accent-600 hover:bg-tx-surface-900 hover:text-tx-accent-500"} ${dragOverTabId === tab.id ? "ring-2 ring-tx-accent-500 ring-opacity-50" : ""}`}
        >
          {editingTabId === tab.id ? (
            <input
              ref={inputRef}
              type="text"
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={handleKeyDown}
              className="bg-tx-surface-900 border border-tx-accent-900/50 rounded px-2 py-0.5 text-sm text-tx-accent-400 focus:outline-none focus:ring-1 focus:ring-tx-accent-700 min-w-[80px]"
              placeholder={t("tabs.namePlaceholder")}
            />
          ) : (
            <>
              <button
                onClick={() => onTabChange(tab.id)}
                onDoubleClick={() => handleStartEdit(tab)}
                className="flex-1 text-left"
              >
                {tab.name}
              </button>
              {!tab.builtin && tabs.length > 1 && (
                <button
                  onClick={() => onDeleteTab(tab.id)}
                  aria-label={t("tabs.delete")}
                  className="ml-2 text-tx-accent-600 hover:text-red-400 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </>
          )}
        </div>
      ))}
      <button
        onClick={onAddTab}
        className="flex items-center px-2 py-1.5 rounded-md text-sm text-tx-accent-600 hover:bg-tx-surface-900 hover:text-tx-accent-500 transition-colors"
        aria-label={t("tabs.add")}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
