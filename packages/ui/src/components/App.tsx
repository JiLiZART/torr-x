import { useCallback, useMemo, useState, type DragEvent } from "react";
import { Edit3, FolderInput, X } from "lucide-react";
import { api, ApiError, type Health, type Torrent } from "@torrentx/api-client";
import { DEFAULT_PREFS, makeUi, UiContext } from "../lib/context";
import { useCapabilities, useSettings, useStats, useTabs, useTorrents } from "../lib/hooks";
import { useBrowserNotifications } from "../lib/notify";
import { useApplyPrefs } from "../lib/theme";
import { useUpdateCheck } from "../lib/updates";
import { usePoll } from "../lib/usePoll";
import { Header } from "./Header";
import { TabBar, type TabView } from "./TabBar";
import { TorrentList } from "./TorrentList";
import { TorrentDetails } from "./TorrentDetails";
import { Terminal } from "./Terminal";
import { StatusBar } from "./StatusBar";
import { Settings } from "./Settings";
import { AddTorrent } from "./AddTorrent";
import { RemoveDialog } from "./RemoveDialog";
import { PromptDialog } from "./Modal";
import { Login } from "./Login";
import type { TorrentAction } from "./TorrentItem";

const isUnauthorized = (e: unknown) => e instanceof ApiError && e.kind === "unauthorized";

type Prompt = { kind: "relocate" | "rename"; torrent: Torrent };

async function downloadTorrentFile(t: Torrent) {
  const res = await fetch(api.torrentFileUrl(t.id), { credentials: "same-origin" });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new ApiError(data?.error?.kind ?? "internal", data?.error?.message ?? res.statusText, res.status);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${t.name}.torrent`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<{ torrent: Torrent; erase: boolean } | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [add, setAdd] = useState<{ file?: File } | null>(null);

  /** Polling failures: only 401 matters globally, the rest is shown where the data is used. */
  const onPollError = useCallback((e: unknown) => {
    if (isUnauthorized(e)) setNeedsLogin(true);
  }, []);
  /** Action failures: 401 → login form, everything else → notice. */
  const handleError = useCallback((e: unknown) => {
    if (isUnauthorized(e)) setNeedsLogin(true);
    else setNotice(e instanceof Error ? e.message : String(e));
  }, []);

  const refreshHealth = useCallback(() => api.health().then(setHealth, onPollError), [onPollError]);
  usePoll(refreshHealth, 10_000);

  const live = { enabled: !needsLogin, onError: onPollError };
  const torrents = useTorrents(live);
  const stats = useStats(live);
  const tabs = useTabs(live);
  const settings = useSettings(live);
  const caps = useCapabilities(health?.engine, live);

  const prefs = settings.data?.preferences ?? DEFAULT_PREFS;
  const ui = useMemo(() => makeUi(prefs, caps.data), [prefs, caps.data]);
  const { t } = ui;
  useApplyPrefs(prefs);
  useBrowserNotifications(torrents.data, prefs.notifications, t);
  const updates = useUpdateCheck(prefs.checkForUpdates && !needsLogin, health?.version);

  const tErr = torrents.error;
  const engineError =
    tErr && (tErr.kind === "engine_unavailable" || tErr.kind === "network") ? tErr.message : null;
  const list = useMemo(() => (engineError ? [] : (torrents.data ?? [])), [engineError, torrents.data]);
  const userTabs = useMemo(() => tabs.data ?? [], [tabs.data]);

  const tabViews: TabView[] = [
    { id: "all", name: t("tabs.all"), builtin: true },
    { id: "downloading", name: t("tabs.downloading"), builtin: true },
    { id: "completed", name: t("tabs.completed"), builtin: true },
    ...userTabs.map((x) => ({ id: x.id, name: x.name, builtin: false })),
  ];
  const defaultTabName = (n: number) => t("tabs.default", { n });

  const refresh = () => {
    void torrents.reload();
    void tabs.reload();
    void stats.reload();
  };
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
      refresh();
    } catch (e) {
      handleError(e);
    }
  };

  const addTab = () =>
    run(async () => {
      const used = new Set(tabViews.map((x) => x.name));
      let n = tabViews.length + 1;
      while (used.has(defaultTabName(n))) n++;
      const tab = await api.createTab(defaultTabName(n));
      setActiveTabId(tab.id);
    });
  const renameTab = (id: string, name: string) =>
    run(() => api.renameTab(id, name || defaultTabName(tabViews.findIndex((x) => x.id === id) + 1)));
  const deleteTab = (id: string) =>
    run(async () => {
      await api.deleteTab(id);
      if (activeTabId === id) setActiveTabId("all");
    });
  const moveToTab = (torrentId: string, tabId: string | null) => run(() => api.setTab(torrentId, tabId));

  const onAction = (tor: Torrent, action: TorrentAction) => {
    switch (action) {
      case "pause":
        return run(() => api.pause(tor.id));
      case "resume":
        return run(() => api.resume(tor.id));
      case "remove":
      case "erase":
        return setRemoving({ torrent: tor, erase: action === "erase" });
      case "reveal":
        return run(() => api.reveal(tor.id));
      case "relocate":
      case "rename":
        return setPrompt({ kind: action, torrent: tor });
      case "torrentFile":
        return run(() => downloadTorrentFile(tor));
      case "magnet":
        return run(async () => {
          await navigator.clipboard.writeText(await api.magnet(tor.id));
          setNotice(t("notice.magnetCopied"));
        });
      case "verify":
        return run(() => api.verify(tor.id));
    }
  };

  const onDropFiles = (e: DragEvent) => {
    const file = [...e.dataTransfer.files].find((f) => f.name.endsWith(".torrent"));
    if (!file) return;
    e.preventDefault();
    setAdd({ file });
  };

  const onSettingsSaved = () => {
    void settings.reload();
    void caps.reload();
    void refreshHealth();
    refresh();
  };

  if (needsLogin) {
    return (
      <UiContext.Provider value={ui}>
        <Login
          onLoggedIn={() => {
            setNeedsLogin(false);
            void refreshHealth();
          }}
        />
      </UiContext.Provider>
    );
  }

  const selected = list.find((x) => x.id === selectedId) ?? null;

  return (
    <UiContext.Provider value={ui}>
      <div
        className="flex flex-col w-full h-full bg-tx-base text-tx-accent-500 font-mono"
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={onDropFiles}
      >
        <Header
          toggleTerminal={() => setTerminalOpen(!terminalOpen)}
          toggleSettings={() => setSettingsOpen(!settingsOpen)}
          toggleAddTorrent={() => setAdd(add ? null : {})}
          searchQuery={search}
          setSearchQuery={setSearch}
          downloadRate={stats.data?.downloadRate ?? null}
          onLogout={
            health?.authRequired ? () => void api.logout().finally(() => setNeedsLogin(true)) : undefined
          }
        />
        <TabBar
          tabs={tabViews}
          activeTabId={activeTabId}
          onTabChange={setActiveTabId}
          onAddTab={addTab}
          onRenameTab={renameTab}
          onDeleteTab={deleteTab}
          onDropTorrent={(tabId, torrentId) => moveToTab(torrentId, tabId)}
        />
        {updates.notice && (
          <div className="flex items-center gap-3 px-4 py-2 bg-tx-accent-900/40 border-b border-tx-accent-900/50 text-sm text-tx-accent-300">
            <span className="flex-1">
              {t("update.available", { version: updates.notice.version })}{" "}
              <a href={updates.notice.url} target="_blank" rel="noreferrer" className="underline">
                {t("update.link")}
              </a>
            </span>
            <button onClick={updates.dismiss} aria-label={t("common.dismiss")} className="hover:text-tx-accent-100">
              <X size={14} />
            </button>
          </div>
        )}
        {notice && (
          <div className="flex items-center gap-3 px-4 py-2 bg-tx-accent-900/40 border-b border-tx-accent-900/50 text-sm text-tx-accent-300">
            <span className="flex-1 break-all">{notice}</span>
            <button onClick={() => setNotice(null)} className="hover:text-tx-accent-100">
              {t("common.dismiss")}
            </button>
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-hidden flex flex-col">
            <TorrentList
              torrents={list}
              activeTabId={activeTabId}
              tabs={userTabs}
              searchQuery={search}
              selectedTorrentId={selectedId}
              onSelectTorrent={setSelectedId}
              onMoveToTab={(tor, tabId) => moveToTab(tor.id, tabId)}
              onAction={onAction}
              engineError={engineError}
              onOpenSettings={() => setSettingsOpen(true)}
            />
            {selected && (
              <TorrentDetails
                id={selected.id}
                onClose={() => setSelectedId(null)}
                onError={handleError}
                onPollError={onPollError}
              />
            )}
            {terminalOpen && !selected && (
              <Terminal onClose={() => setTerminalOpen(false)} onChanged={refresh} />
            )}
          </main>
        </div>
        <StatusBar stats={stats.data} />
        {settingsOpen && (
          <Settings
            onClose={() => setSettingsOpen(false)}
            onSaved={onSettingsSaved}
            onError={handleError}
            engineError={engineError}
            version={health?.version}
            checkUpdates={updates.checkNow}
          />
        )}
        {add && (
          <AddTorrent
            onClose={() => setAdd(null)}
            onAdded={refresh}
            initialFile={add.file}
            settings={settings.data}
            diskFree={stats.data?.diskFree ?? null}
          />
        )}
        {removing && (
          <RemoveDialog
            torrent={removing.torrent}
            deleteData={removing.erase}
            onClose={() => setRemoving(null)}
            onRemoved={() => {
              if (removing.torrent.id === selectedId) setSelectedId(null);
              setRemoving(null);
              refresh();
            }}
          />
        )}
        {prompt && (
          <PromptDialog
            title={
              prompt.kind === "relocate" ? (
                <>
                  <FolderInput size={16} className="mr-2" /> {t("action.relocate")}
                </>
              ) : (
                <>
                  <Edit3 size={16} className="mr-2" /> {t("action.rename")}
                </>
              )
            }
            label={prompt.kind === "relocate" ? t("prompt.newPath") : t("prompt.newName")}
            initial={prompt.kind === "relocate" ? prompt.torrent.savePath : prompt.torrent.name}
            onClose={() => setPrompt(null)}
            onSubmit={async (value) => {
              if (prompt.kind === "relocate") await api.relocate(prompt.torrent.id, value);
              else await api.rename(prompt.torrent.id, value);
              refresh();
            }}
          />
        )}
      </div>
    </UiContext.Provider>
  );
}
