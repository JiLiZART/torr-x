import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { Edit3, FolderInput, Tag, X } from "lucide-react";
import { api, ApiError, type Health, type Tab, type TabPatch, type Torrent } from "@torrentx/api-client";
import { compare, evaluate, parse, sortKeys } from "@torrentx/query";
import { DEFAULT_PREFS, makeUi, UiContext } from "../lib/context";
import { useCapabilities, useSettings, useStats, useTabs, useTorrents } from "../lib/hooks";
import { canonical, clickSort, combine, fuzzyNode, hasLens, NO_LENS, predicateCount, type Lens } from "../lib/lens";
import { useBrowserNotifications } from "../lib/notify";
import { ALL_TAB, useRoute } from "../lib/route";
import { useApplyPrefs } from "../lib/theme";
import { useUpdateCheck } from "../lib/updates";
import { usePoll } from "../lib/usePoll";
import { initDesktopChrome } from "../lib/window";
import { FilterBar, type SaveDraft } from "./FilterBar";
import { Shell } from "./Shell";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TorrentList } from "./TorrentList";
import { TorrentDetails } from "./TorrentDetails";
import { Terminal } from "./Terminal";
import { StatusBar } from "./StatusBar";
import { Settings } from "./Settings";
import { AddTorrent } from "./AddTorrent";
import { RemoveDialog } from "./RemoveDialog";
import { PromptDialog } from "./Modal";
import { Login } from "./Login";
import type { TorrentAction } from "./TorrentRow";

const NO_TABS: Tab[] = [];
const DENSITY_KEY = "tx-density";
const UNDO_SAVE_MS = 6000;

const isUnauthorized = (e: unknown) => e instanceof ApiError && e.kind === "unauthorized";

type Prompt = { kind: "relocate" | "rename" | "tags"; torrent: Torrent };

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
  const [tabId, navigate] = useRoute();
  // The lens: ephemeral, per tab, in memory. Only "Save as tab" ever writes it anywhere.
  const [lens, setLensState] = useState<Lens>(NO_LENS);
  const [undo, setUndo] = useState<Lens[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, Lens>>({});
  const [saveOpen, setSaveOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [saved, setSaved] = useState<{ tab: Tab; from: string; lens: Lens } | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compact, setCompact] = useState(() => localStorage.getItem(DENSITY_KEY) === "compact");
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
  useEffect(() => initDesktopChrome(), []);
  useBrowserNotifications(torrents.data, prefs.notifications, t);
  const updates = useUpdateCheck(prefs.checkForUpdates && !needsLogin, health?.version);

  const tErr = torrents.error;
  const engineError =
    tErr && (tErr.kind === "engine_unavailable" || tErr.kind === "network") ? tErr.message : null;
  const list = useMemo(() => (engineError ? [] : (torrents.data ?? [])), [engineError, torrents.data]);
  const tabList = tabs.data?.tabs ?? NO_TABS;

  const parsed = useMemo(() => new Map(tabList.map((tab) => [tab.id, parse(tab.query)])), [tabList]);
  const { counts, errors } = useMemo(() => {
    const now = Date.now() / 1000;
    const counts: Record<string, number> = {};
    const errors: Record<string, string> = {};
    for (const tab of tabList) {
      const { ast, error } = parsed.get(tab.id)!;
      // An unparseable tab lists nothing.
      counts[tab.id] = ast ? list.filter((row) => evaluate(ast, row, now)).length : 0;
      if (error) errors[tab.id] = error.message;
    }
    return { counts, errors };
  }, [tabList, parsed, list]);

  const activeTab = tabList.find((tab) => tab.id === tabId);
  // Until the tabs load, the list shows everything rather than an error.
  const everything = useMemo(() => parse(""), []);
  const tabParsed = (activeTab && parsed.get(activeTab.id)) || everything;
  const tabAst = tabParsed.ast;
  const fuzzy = useMemo(() => fuzzyNode(lens.fuzzy), [lens.fuzzy]);
  const lensAst = useMemo(() => parse(lens.query).ast, [lens.query]);
  const order = useMemo(
    () => [...(lensAst ? sortKeys(lensAst) : []), ...(tabAst ? sortKeys(tabAst) : [])],
    [lensAst, tabAst],
  );
  // The one evaluation the list, the status bar and the sidebar counts agree on.
  const visible = useMemo(() => {
    if (!tabAst) return [];
    const now = Date.now() / 1000;
    const nodes = [tabAst, fuzzy, lensAst].filter((node) => node !== null);
    return list.filter((row) => nodes.every((node) => evaluate(node, row, now))).sort(compare(order));
  }, [list, tabAst, fuzzy, lensAst, order]);
  const lensCount = hasLens(lens) ? predicateCount(lens.query) : null;
  const inTab = (activeTab && counts[activeTab.id]) ?? list.length;
  const tabLabel = (tab: Tab) => tab.name || tab.query || t("tabs.untitled");
  const values = useMemo(
    () => ({
      tag: [...new Set(list.flatMap((row) => row.tags))].sort(),
      tracker: [...new Set(list.flatMap((row) => row.tracker ?? []))].sort(),
    }),
    [list],
  );

  /** A chip-level change: undoable with ⌘Z. */
  const setLens = (next: Lens) => {
    setUndo((stack) => [...stack.slice(-49), lens]);
    setLensState(next);
  };
  const undoLens = () => {
    if (undo.length === 0) return;
    setLensState(undo[undo.length - 1]);
    setUndo(undo.slice(0, -1));
  };

  // Switching tabs (sidebar, back/forward, reload) clears the lens; the old tab keeps a session
  // snapshot behind its "restore lens" pill. `onSwitch` lets save / undo-save override that once.
  const lensRef = useRef(lens);
  lensRef.current = lens;
  const lastTab = useRef(tabId);
  const onSwitch = useRef({ snapshot: true, next: NO_LENS });
  useEffect(() => {
    if (lastTab.current === tabId) return;
    const from = lastTab.current;
    lastTab.current = tabId;
    const { snapshot, next } = onSwitch.current;
    onSwitch.current = { snapshot: true, next: NO_LENS };
    const old = lensRef.current;
    if (snapshot && hasLens(old)) setSnapshots((all) => ({ ...all, [from]: old }));
    setLensState(next);
    setUndo([]);
    setSaveOpen(false);
    setBuilderOpen(false);
  }, [tabId]);

  // An address naming a tab that no longer exists opens All and says why.
  const loadedTabs = tabs.data?.tabs;
  useEffect(() => {
    if (!loadedTabs || loadedTabs.some((tab) => tab.id === tabId)) return;
    navigate(ALL_TAB, true);
    setNotice(t("tabs.gone"));
  }, [loadedTabs, tabId, navigate, t]);

  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), UNDO_SAVE_MS);
    return () => clearTimeout(timer);
  }, [saved]);

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

  const createTab = () =>
    run(async () => {
      const used = new Set(tabList.map((tab) => tab.name));
      let n = tabList.length + 1;
      while (used.has(t("tabs.default", { n }))) n++;
      const tab = await api.createTab({ name: t("tabs.default", { n }), query: "" });
      await tabs.reload();
      navigate(tab.id);
    });
  const patchTab = (id: string, patch: TabPatch) => run(() => api.updateTab(id, patch));
  const deleteTab = (id: string) =>
    run(async () => {
      if (id === tabId) navigate(ALL_TAB);
      await api.deleteTab(id);
      await tabs.reload();
    });

  // "Save as tab": the only way a lens reaches the sidebar. The new tab holds tab query AND lens.
  const saveQuery = tabAst ? combine(tabAst, lens) : "";
  const duplicate = tabList.find((tab) => canonical(tab.query) === saveQuery);
  const saveDraft: SaveDraft | null =
    saveOpen && tabAst && hasLens(lens)
      ? { query: saveQuery, duplicate: duplicate ? { id: duplicate.id, label: tabLabel(duplicate) } : null }
      : null;
  const confirmSave = (name: string) =>
    run(async () => {
      const tab = await api.createTab({ name, query: saveQuery, group: activeTab?.group ?? null });
      await tabs.reload();
      setSaved({ tab, from: tabId, lens });
      // The lens became the tab: it is cleared, not kept as a snapshot.
      onSwitch.current = { snapshot: false, next: NO_LENS };
      navigate(tab.id);
    });
  const undoSave = () => {
    if (!saved) return;
    const { tab, from, lens: before } = saved;
    setSaved(null);
    return run(async () => {
      if (tabId === from) setLensState(before);
      else {
        onSwitch.current = { snapshot: false, next: before };
        navigate(from);
      }
      await api.deleteTab(tab.id);
      await tabs.reload();
    });
  };
  const restoreLens = () => {
    setLens(snapshots[tabId]);
    setSnapshots((all) => Object.fromEntries(Object.entries(all).filter(([id]) => id !== tabId)));
  };
  const toggleDensity = () => {
    localStorage.setItem(DENSITY_KEY, compact ? "comfortable" : "compact");
    setCompact(!compact);
  };

  useEffect(() => {
    if (needsLogin) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const typing = e.target instanceof HTMLElement && e.target.matches("input, textarea, select");
      if (e.ctrlKey && e.key === "`") setTerminalOpen((open) => !open);
      else if (mod && e.shiftKey && key === "t") void createTab();
      else if (mod && e.shiftKey && key === "k") setLens(NO_LENS);
      else if (mod && key === "f" && !typing) setBuilderOpen(true);
      else if (mod && key === "t") setAdd({});
      else if (mod && key === "s") setSaveOpen(hasLens(lens));
      else if (mod && key === "z" && !typing) undoLens();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

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
      case "tags":
        return setPrompt({ kind: action, torrent: tor });
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

  const banner = "flex shrink-0 items-center gap-[10px] border-b border-ui-border bg-ui-accent-soft px-[16px] py-[8px] text-[12px] text-ui-accent";

  return (
    <UiContext.Provider value={ui}>
      <Shell
        onDragOver={(e) => e.dataTransfer.types.includes("Files") && e.preventDefault()}
        onDrop={onDropFiles}
        sidebar={
          sidebarCollapsed ? null : (
            <Sidebar
              tabs={tabList}
              activeId={tabId}
              counts={counts}
              errors={errors}
              lensCount={lensCount}
              stats={stats.data}
              onActivate={navigate}
              onCreate={createTab}
              onPatch={patchTab}
              onDelete={deleteTab}
              onTrigger={() => setAdd({})}
              onSaveLens={hasLens(lens) ? () => setSaveOpen(true) : null}
              onCollapse={() => setSidebarCollapsed(true)}
            />
          )
        }
        top={
          <TopBar
            title={activeTab ? tabLabel(activeTab) : ""}
            lensCount={lensCount}
            sidebarCollapsed={sidebarCollapsed}
            onExpandSidebar={() => setSidebarCollapsed(false)}
            compact={compact}
            onToggleDensity={toggleDensity}
            terminalOpen={terminalOpen}
            onToggleTerminal={() => setTerminalOpen(!terminalOpen)}
            onOpenSettings={() => setSettingsOpen(true)}
            onLogout={
              health?.authRequired ? () => void api.logout().finally(() => setNeedsLogin(true)) : undefined
            }
          />
        }
        status={
          <StatusBar
            shown={visible.length}
            inTab={inTab}
            total={list.length}
            lensActive={hasLens(lens)}
            engine={health?.engine}
            engineError={engineError}
            stats={stats.data}
            terminalOpen={terminalOpen}
            onToggleTerminal={() => setTerminalOpen(!terminalOpen)}
          />
        }
      >
        <FilterBar
          lens={lens}
          onLens={setLens}
          onFuzzy={(text) => setLensState((current) => ({ ...current, fuzzy: text }))}
          snapshot={!hasLens(lens) ? (snapshots[tabId] ?? null) : null}
          onRestore={restoreLens}
          tabName={activeTab ? tabLabel(activeTab) : ""}
          all={list}
          values={values}
          builderOpen={builderOpen}
          onBuilder={setBuilderOpen}
          save={saveDraft}
          onSaveOpen={() => setSaveOpen(true)}
          onSaveConfirm={(name) => void confirmSave(name)}
          onSaveCancel={() => setSaveOpen(false)}
          onGoTo={navigate}
        />
        {updates.notice && (
          <div className={banner}>
            <span className="flex-1">
              {t("update.available", { version: updates.notice.version })}{" "}
              <a href={updates.notice.url} target="_blank" rel="noreferrer" className="underline">
                {t("update.link")}
              </a>
            </span>
            <button onClick={updates.dismiss} aria-label={t("common.dismiss")} className="hover:text-ui-text">
              <X size={14} />
            </button>
          </div>
        )}
        {saved && (
          <div className={banner} role="status">
            <span className="flex-1 break-all">{t("save.done", { tab: tabLabel(saved.tab) })}</span>
            <button onClick={() => void undoSave()} className="underline hover:text-ui-text">
              {t("save.undo")}
            </button>
          </div>
        )}
        {notice && (
          <div className={banner}>
            <span className="flex-1 break-all">{notice}</span>
            <button onClick={() => setNotice(null)} className="hover:text-ui-text">
              {t("common.dismiss")}
            </button>
          </div>
        )}
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <TorrentList
            torrents={visible}
            all={list}
            tabAst={tabAst}
            tabError={tabParsed.error}
            tabQuery={activeTab?.query ?? ""}
            tabName={activeTab ? tabLabel(activeTab) : ""}
            onOpenBuilder={() => setBuilderOpen(true)}
            onSearchAll={() => {
              // Same lens, whole library: the All tab.
              onSwitch.current = { snapshot: true, next: lens };
              navigate(ALL_TAB);
            }}
            fuzzy={fuzzy}
            lensAst={lensAst}
            lens={lens}
            onLens={setLens}
            sort={order[0]}
            onSort={(field) => setLens({ ...lens, query: clickSort(lens.query, tabAst ? sortKeys(tabAst) : [], field) })}
            compact={compact}
            selectedTorrentId={selectedId}
            onSelectTorrent={setSelectedId}
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
              ) : prompt.kind === "rename" ? (
                <>
                  <Edit3 size={16} className="mr-2" /> {t("action.rename")}
                </>
              ) : (
                <>
                  <Tag size={16} className="mr-2" /> {t("action.tags")}
                </>
              )
            }
            label={t(prompt.kind === "relocate" ? "prompt.newPath" : prompt.kind === "rename" ? "prompt.newName" : "prompt.tags")}
            initial={
              prompt.kind === "relocate"
                ? prompt.torrent.savePath
                : prompt.kind === "rename"
                  ? prompt.torrent.name
                  : prompt.torrent.tags.join(", ")
            }
            allowEmpty={prompt.kind === "tags"}
            onClose={() => setPrompt(null)}
            onSubmit={async (value) => {
              if (prompt.kind === "relocate") await api.relocate(prompt.torrent.id, value);
              else if (prompt.kind === "rename") await api.rename(prompt.torrent.id, value);
              else await api.setTags(prompt.torrent.id, value.split(","));
              refresh();
            }}
          />
        )}
      </Shell>
    </UiContext.Provider>
  );
}
