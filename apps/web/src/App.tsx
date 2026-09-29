import { useCallback, useState, type DragEvent } from "react";
import { AlertTriangle } from "lucide-react";
import { api, ApiError, type Health, type Torrent } from "@torrentx/api-client";
import { Header } from "./components/Header";
import { TabBar } from "./components/TabBar";
import type { Filter } from "./lib/filters";
import { TorrentList } from "./components/TorrentList";
import { TorrentDetails } from "./components/TorrentDetails";
import { StatusBar } from "./components/StatusBar";
import { Settings } from "./components/Settings";
import { AddTorrent } from "./components/AddTorrent";
import { RemoveDialog } from "./components/RemoveDialog";
import { Login } from "./components/Login";
import { usePoll } from "./lib/usePoll";
import { magnet } from "./lib/format";

export type Action = "pause" | "resume" | "remove" | "copy-magnet";

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [torrents, setTorrents] = useState<Torrent[]>([]);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Torrent | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  /** Shared error handling: 401 → login form, everything else → notice. */
  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.kind === "unauthorized") {
      setNeedsLogin(true);
    } else {
      setNotice(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const refreshHealth = useCallback(
    () => api.health().then(setHealth, handleError),
    [handleError],
  );

  const refresh = useCallback(async () => {
    try {
      setTorrents(await api.list());
      setEngineError(null);
    } catch (e) {
      if (e instanceof ApiError && (e.kind === "engine_unavailable" || e.kind === "network")) {
        setEngineError(e.message);
        setTorrents([]);
      } else {
        handleError(e);
      }
    }
  }, [handleError]);

  usePoll(refreshHealth, 10_000);
  usePoll(refresh, 1500, !needsLogin);

  const onAction = async (t: Torrent, action: Action) => {
    try {
      if (action === "pause") await api.pause(t.id);
      else if (action === "resume") await api.resume(t.id);
      else if (action === "remove") return setRemoving(t);
      else if (action === "copy-magnet") {
        await navigator.clipboard.writeText(magnet(t));
        return setNotice("Magnet link copied");
      }
      await refresh();
    } catch (e) {
      handleError(e);
    }
  };

  const onDropFiles = async (e: DragEvent) => {
    const files = [...e.dataTransfer.files].filter((f) => f.name.endsWith(".torrent"));
    if (files.length === 0) return;
    e.preventDefault();
    for (const f of files) {
      await api.addFile(f).catch(handleError);
    }
    await refresh();
  };

  if (needsLogin) {
    return (
      <Login
        onLoggedIn={() => {
          setNeedsLogin(false);
          void refreshHealth();
        }}
      />
    );
  }

  const selected = torrents.find((t) => t.id === selectedId) ?? null;

  return (
    <div
      className="flex flex-col w-full h-full bg-black text-green-500 font-mono"
      onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
      onDrop={onDropFiles}
    >
      <Header
        search={search}
        setSearch={setSearch}
        onAdd={() => setAddOpen(true)}
        onSettings={() => setSettingsOpen(true)}
        onLogout={
          health?.authRequired
            ? () => api.logout().finally(() => setNeedsLogin(true))
            : undefined
        }
      />
      <TabBar torrents={torrents} filter={filter} onChange={setFilter} />
      {engineError && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-950/60 border-b border-red-900/60 text-sm text-red-300">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1 break-all">{engineError}</span>
          <button onClick={() => setSettingsOpen(true)} className="underline hover:text-red-100">
            Open settings
          </button>
        </div>
      )}
      {notice && (
        <div className="flex items-center gap-3 px-4 py-2 bg-green-950/60 border-b border-green-900/50 text-sm text-green-300">
          <span className="flex-1 break-all">{notice}</span>
          <button onClick={() => setNotice(null)} className="hover:text-green-100">
            dismiss
          </button>
        </div>
      )}
      <main className="flex-1 overflow-hidden flex flex-col">
        <TorrentList
          torrents={torrents}
          filter={filter}
          search={search}
          selectedId={selectedId}
          onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
          onAction={onAction}
        />
        {selected && (
          <TorrentDetails torrent={selected} onClose={() => setSelectedId(null)} onError={handleError} />
        )}
      </main>
      <StatusBar torrents={torrents} health={health} />
      {settingsOpen && (
        <Settings
          onClose={() => setSettingsOpen(false)}
          onSaved={() => {
            void refreshHealth();
            void refresh();
          }}
          onError={handleError}
        />
      )}
      {addOpen && <AddTorrent onClose={() => setAddOpen(false)} onAdded={refresh} />}
      {removing && (
        <RemoveDialog
          torrent={removing}
          onClose={() => setRemoving(null)}
          onRemoved={() => {
            if (removing.id === selectedId) setSelectedId(null);
            setRemoving(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
