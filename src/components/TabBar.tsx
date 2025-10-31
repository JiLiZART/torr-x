import React, { useEffect, useState, useRef } from 'react';
import { Plus, X, MoreVertical } from 'lucide-react';
interface Tab {
  id: string;
  name: string;
}
interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onTabChange: (tabId: string) => void;
  onAddTab: () => void;
  onRenameTab: (tabId: string, newName: string) => void;
  onDeleteTab: (tabId: string) => void;
  onDragOver: (tabId: string) => void;
  onDrop: (tabId: string) => void;
  dragOverTabId: string | null;
}
export function TabBar({
  tabs,
  activeTabId,
  onTabChange,
  onAddTab,
  onRenameTab,
  onDeleteTab,
  onDragOver,
  onDrop,
  dragOverTabId
}: TabBarProps) {
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);
  const handleStartEdit = (tab: Tab) => {
    setEditingTabId(tab.id);
    setEditingName(tab.name);
  };
  const handleFinishEdit = () => {
    if (editingTabId) {
      const finalName = editingName.trim();
      onRenameTab(editingTabId, finalName);
      setEditingTabId(null);
      setEditingName('');
    }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishEdit();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingName('');
    }
  };
  const handleDragOver = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    onDragOver(tabId);
  };
  const handleDrop = (e: React.DragEvent, tabId: string) => {
    e.preventDefault();
    onDrop(tabId);
  };
  return <div className="border-b border-green-900/30 bg-gray-950 px-4 py-2 flex items-center space-x-1 overflow-x-auto">
      {tabs.map(tab => <div key={tab.id} onDragOver={e => handleDragOver(e, tab.id)} onDrop={e => handleDrop(e, tab.id)} className={`relative flex items-center px-3 py-1.5 rounded-md text-sm transition-colors ${activeTabId === tab.id ? 'bg-green-900/20 text-green-400' : 'text-green-600 hover:bg-gray-900 hover:text-green-500'} ${dragOverTabId === tab.id ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}>
          {editingTabId === tab.id ? <input ref={inputRef} type="text" value={editingName} onChange={e => setEditingName(e.target.value)} onBlur={handleFinishEdit} onKeyDown={handleKeyDown} className="bg-gray-900 border border-green-900/50 rounded px-2 py-0.5 text-sm text-green-400 focus:outline-none focus:ring-1 focus:ring-green-700 min-w-[80px]" placeholder="Tab name..." /> : <>
              <button onClick={() => onTabChange(tab.id)} onDoubleClick={() => handleStartEdit(tab)} className="flex-1 text-left">
                {tab.name}
              </button>
              {tabs.length > 1 && <button onClick={() => onDeleteTab(tab.id)} className="ml-2 text-green-600 hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>}
            </>}
        </div>)}
      <button onClick={onAddTab} className="flex items-center px-2 py-1.5 rounded-md text-sm text-green-600 hover:bg-gray-900 hover:text-green-500 transition-colors" aria-label="Add new tab">
        <Plus size={16} />
      </button>
    </div>;
}