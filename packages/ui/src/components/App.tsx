import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent } from "react";
import { Edit3, FolderInput, Tag, X } from "lucide-react";
import { api, ApiError, type Health, type Tab, type TabPatch, type Torrent } from "@torrentx/api-client";
import { compare, evaluate, parse, sortKeys } from "@torrentx/query";
import { DEFAULT_PREFS, makeUi, UiContext } from "../lib/context";
import { useCapabilities, useSettings, useStats, useTabs, useTorrents } from "../lib/hooks";
import { canonical, clickSort, combine, fuzzyNode, hasLens, NO_LENS, predicateCount, sections, type Lens } from "../lib/lens";
import { COMMAND_FOR_ACTION, COMMANDS, type Handler, type Handlers, type TorrentAction } from "../lib/commands";
import { commandFor, IS_MAC, useKeymap } from "../lib/keymap";
import { useBrowserNotifications } from "../lib/notify";
import { ALL_TAB, useRoute } from "../lib/route";
import { useApplyPrefs } from "../lib/theme";
import { useUpdateCheck } from "../lib/updates";
import { usePoll } from "../lib/usePoll";
import { initDesktopChrome, isTauri } from "../lib/window";
import type { AddSource } from "../lib/addFlow";
import { FilterBar, type SaveDraft } from "./FilterBar";
import { Shell } from "./Shell";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { TorrentList } from "./TorrentList";
import { TorrentDetails } from "./TorrentDetails";
import { Terminal } from "./Terminal";
import { StatusBar } from "./StatusBar";
import { Settings } from "./Settings";
import { RemoveDialog } from "./RemoveDialog";
import { PromptDialog } from "./Modal";
import { Login } from "./Login";
import { Palette } from "./Palette";
import { ShortcutSheet } from "./ShortcutSheet";

const NO_TABS: Tab[] = [];
const DENSITY_KEY = "tx-density";
const FILTER_BAR_KEY = "tx-filter-bar";
const UNDO_SAVE_MS = 6000;

const isUnauthorized = (e: unknown) => e instanceof ApiError && e.kind === "unauthorized";

type Prompt = { kind: "relocate" | "rename" | "tags"; torrents: Torrent[] };

const LIST_KEYS = COMMANDS.filter((def) => def.local && def.group === "list");
const DESKTOP = isTauri();

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
  const [filterCollapsed, setFilterCollapsedState] = useState(() => localStorage.getItem(FILTER_BAR_KEY) === "collapsed");
  const setFilterCollapsed = (collapsed: boolean) => {
    localStorage.setItem(FILTER_BAR_KEY, collapsed ? "collapsed" : "open");
    setFilterCollapsedState(collapsed);
  };
  // Selection (many rows), the keyboard row cursor, and the torrent whose details are open.
  const [selection, setSelection] = useState<string[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  // The one panel: Spotlight / palette (`input` ">" = commands), optionally opened in its add flow.
  const [palette, setPalette] = useState<{ input: string; add?: AddSource } | null>(null);
  const pickRef = useRef<HTMLInputElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [renameRequest, setRenameRequest] = useState(0);
  const [removing, setRemoving] = useState<{ torrents: Torrent[]; erase: boolean } | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

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

  // Over the defaults, so a server from before a preference existed (e.g. `appearance`) cannot break the UI.
  const loaded = settings.data?.preferences;
  const prefs = useMemo(() => ({ ...DEFAULT_PREFS, ...loaded }), [loaded]);
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

  // ---- commands: one handler per registry entry ---------------------------------------------

  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const selected = useMemo(() => list.filter((row) => selectedSet.has(row.id)), [list, selectedSet]);
  // Sidebar order (pinned, smart, groups, ad-hoc): what ⌘1…9 and next/previous walk.
  const sidebarOrder = useMemo(() => {
    const s = sections(tabList);
    return [...s.pinned, ...s.smart, ...s.groups.flatMap((g) => g.tabs), ...s.adhoc];
  }, [tabList]);
  const stepTab = (step: number) => {
    const at = sidebarOrder.findIndex((tab) => tab.id === tabId);
    const next = sidebarOrder[(at + step + sidebarOrder.length) % sidebarOrder.length];
    if (next) navigate(next.id);
  };
  const moveCursor = (step: number, extend: boolean) => {
    if (visible.length === 0) return;
    const at = visible.findIndex((row) => row.id === cursor);
    const next = visible[Math.min(Math.max(at < 0 ? 0 : at + step, 0), visible.length - 1)].id;
    setCursor(next);
    setSelection((current) => (extend ? [...new Set([...current, ...(cursor ? [cursor] : []), next])] : [next]));
    document.querySelector(`[data-row="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };
  const openDetails = (id: string | null) => id && setDetailId(id);
  const pauseRows = (rows: Torrent[]) => run(() => Promise.all(rows.map((row) => api.pause(row.id))));
  const resumeRows = (rows: Torrent[]) => run(() => Promise.all(rows.map((row) => api.resume(row.id))));

  /** Selection commands for `targets` (the selection, or the row whose menu was used). */
  const selectionHandlers = (targets: Torrent[]): Handlers => {
    const none = targets.length === 0 ? t("cmd.needSelection") : null;
    const one = none ?? (targets.length > 1 ? t("cmd.needOne") : null);
    const single = targets[0];
    const gated = (feature: string) => one ?? ui.gate(feature) ?? null;
    const allPaused = targets.length > 0 && targets.every((row) => row.status === "paused");
    return {
      // Space toggles: resumes when everything selected is paused.
      "sel.pause": { run: () => (allPaused ? resumeRows(targets) : pauseRows(targets)), disabled: none },
      "sel.resume": { run: () => resumeRows(targets), disabled: none },
      "sel.remove": { run: () => setRemoving({ torrents: targets, erase: false }), disabled: none },
      "sel.erase": { run: () => setRemoving({ torrents: targets, erase: true }), disabled: none },
      "sel.tags": { run: () => setPrompt({ kind: "tags", torrents: targets }), disabled: none },
      "sel.verify": { run: () => run(() => Promise.all(targets.map((row) => api.verify(row.id)))), disabled: none ?? ui.gate("verify") ?? null },
      "sel.reveal": { run: () => run(() => api.reveal(single.id)), disabled: one },
      "sel.relocate": { run: () => setPrompt({ kind: "relocate", torrents: [single] }), disabled: gated("relocate") },
      "sel.rename": { run: () => setPrompt({ kind: "rename", torrents: [single] }), disabled: gated("rename") },
      "sel.torrentFile": { run: () => run(() => downloadTorrentFile(single)), disabled: gated("torrentFile") },
      "sel.magnet": {
        run: () =>
          run(async () => {
            await navigator.clipboard.writeText(await api.magnet(single.id));
            setNotice(t("notice.magnetCopied"));
          }),
        disabled: one,
      },
    };
  };
  const notPaused = (rows: Torrent[]) => rows.filter((row) => row.status !== "paused");
  const paused = (rows: Torrent[]) => rows.filter((row) => row.status === "paused");
  const handler = (run: Handler["run"], disabled?: string | null): Handler => ({ run, disabled });
  const handlers: Handlers = {
    "palette.open": handler(() => setPalette({ input: "" })),
    "palette.commands": handler(() => setPalette({ input: ">" })),
    "sheet.open": handler(() => setSheetOpen(true)),
    "torrent.add": handler(() => pickRef.current?.click()),
    "tab.jump": handler((n) => {
      const tab = sidebarOrder[(n ?? 1) - 1];
      if (tab) navigate(tab.id);
    }),
    "tab.next": handler(() => stepTab(1)),
    "tab.prev": handler(() => stepTab(-1)),
    // New tab is the same surface: a tab is created from a query there.
    "tab.new": handler(() => setPalette({ input: "" })),
    "tab.save": handler(() => setSaveOpen(true), hasLens(lens) ? null : t("cmd.needLens")),
    "tab.rename": handler(() => {
      setSidebarCollapsed(false);
      setRenameRequest((n) => n + 1);
    }),
    "tab.moveUp": handler(() => activeTab && patchTab(activeTab.id, { order: Math.max(activeTab.order - 1, 0) })),
    "tab.moveDown": handler(() => activeTab && patchTab(activeTab.id, { order: activeTab.order + 1 })),
    "sidebar.toggle": handler(() => setSidebarCollapsed((c) => !c)),
    "filterBar.toggle": handler(() => setFilterCollapsed(!filterCollapsed)),
    // Both need the expanded bar; the input mounts on the next render.
    "filter.focus": handler(() => {
      setFilterCollapsed(false);
      requestAnimationFrame(() => document.getElementById("tx-fuzzy")?.focus());
    }),
    "builder.open": handler(() => {
      setFilterCollapsed(false);
      setBuilderOpen(true);
    }),
    "lens.clear": handler(() => setLens(NO_LENS), hasLens(lens) ? null : t("cmd.needLens")),
    "lens.undo": handler(undoLens, undo.length > 0 ? null : t("cmd.nothingToUndo")),
    "list.down": handler(() => moveCursor(1, false)),
    "list.up": handler(() => moveCursor(-1, false)),
    "list.extendDown": handler(() => moveCursor(1, true)),
    "list.extendUp": handler(() => moveCursor(-1, true)),
    "list.selectAll": handler(() => setSelection(visible.map((row) => row.id))),
    "list.open": handler(() => openDetails(cursor ?? selection[0] ?? null), cursor || selection.length ? null : t("cmd.needSelection")),
    ...selectionHandlers(selected),
    "tab.pauseAll": handler(() => pauseRows(notPaused(visible))),
    "tab.resumeAll": handler(() => resumeRows(paused(visible))),
    "all.pause": handler(() => pauseRows(notPaused(list))),
    "all.resume": handler(() => resumeRows(paused(list))),
    "nav.back": handler(() => window.history.back()),
    "nav.forward": handler(() => window.history.forward()),
    "settings.open": handler(() => setSettingsOpen(true)),
    "terminal.toggle": handler(() => setTerminalOpen((open) => !open)),
    "density.toggle": handler(() => toggleDensity()),
    "auth.logout": { run: () => void api.logout().finally(() => setNeedsLogin(true)), unavailable: !health?.authRequired },
  };
  const dialogOpen = palette !== null || sheetOpen || settingsOpen || !!removing || !!prompt;
  useKeymap(COMMANDS, handlers, !needsLogin && !dialogOpen, DESKTOP);

  const onListKey = (e: ReactKeyboardEvent) => {
    const found = commandFor(e.nativeEvent, LIST_KEYS, { mac: IS_MAC, desktop: DESKTOP });
    const h = found && handlers[found.def.id];
    if (!found || !h) return;
    e.preventDefault();
    if (!h.disabled) h.run(found.arg);
  };
  const onRowClick = (id: string, e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey) {
      setSelection((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    } else if (e.shiftKey && cursor) {
      const [a, b] = [visible.findIndex((row) => row.id === cursor), visible.findIndex((row) => row.id === id)].sort((x, y) => x - y);
      setSelection(visible.slice(a, b + 1).map((row) => row.id));
      return;
    } else {
      setSelection([id]);
      setDetailId(detailId === id ? null : id);
    }
    setCursor(id);
  };
  const onAction = (tor: Torrent, action: TorrentAction) => selectionHandlers([tor])[COMMAND_FOR_ACTION[action]].run();

  const jumpTorrent = (id: string) => {
    if (!visible.some((row) => row.id === id)) {
      onSwitch.current = { snapshot: true, next: NO_LENS };
      navigate(ALL_TAB);
    }
    setSelection([id]);
    setCursor(id);
    setDetailId(id);
  };
  const applyFromPalette = (next: Lens, inAll: boolean) => {
    if (inAll && tabId !== ALL_TAB) {
      onSwitch.current = { snapshot: true, next };
      navigate(ALL_TAB);
    } else setLens(next);
  };
  const createFromPalette = (query: string) =>
    run(async () => {
      // Named by its query, not activated: the palette never steals the current view.
      const tab = await api.createTab({ name: query, query });
      setNotice(t("palette.created", { tab: tab.name }));
    });

  const onDropFiles = (e: DragEvent) => {
    const file = [...e.dataTransfer.files].find((f) => f.name.endsWith(".torrent"));
    if (!file) return;
    e.preventDefault();
    setPalette({ input: "", add: { kind: "file", file } });
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

  const detail = list.find((x) => x.id === detailId) ?? null;
  const tabRows = tabAst ? list.filter((row) => evaluate(tabAst, row)) : [];

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
              onCreate={() => setPalette({ input: "" })}
              onPatch={patchTab}
              onDelete={deleteTab}
              onTrigger={() => setPalette({ input: "" })}
              onSaveLens={hasLens(lens) ? () => setSaveOpen(true) : null}
              renameRequest={renameRequest}
            />
          )
        }
        top={
          <TopBar
            title={activeTab ? tabLabel(activeTab) : ""}
            lensCount={lensCount}
            sidebarCollapsed={sidebarCollapsed}
            onExpandSidebar={() => setSidebarCollapsed(false)}
            onCollapseSidebar={() => setSidebarCollapsed(true)}
            compact={compact}
            onToggleDensity={toggleDensity}
            filterBarOpen={!filterCollapsed}
            onToggleFilterBar={() => setFilterCollapsed(!filterCollapsed)}
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
          collapsed={filterCollapsed}
          onCollapse={setFilterCollapsed}
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
            onOpenBuilder={() => {
              setFilterCollapsed(false);
              setBuilderOpen(true);
            }}
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
            selection={selectedSet}
            cursor={cursor}
            onRowClick={onRowClick}
            onRowOpen={(id) => setDetailId(id)}
            onListKey={onListKey}
            onAction={onAction}
            engineError={engineError}
            onOpenSettings={() => setSettingsOpen(true)}
          />
          {detail && (
            <TorrentDetails
              id={detail.id}
              onClose={() => setDetailId(null)}
              onError={handleError}
              onPollError={onPollError}
            />
          )}
          {terminalOpen && !detail && (
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
        {palette !== null && (
          <Palette
            initial={palette.input}
            initialAdd={palette.add}
            settings={settings.data}
            diskFree={stats.data?.diskFree ?? null}
            onAdded={(_id, name) => {
              refresh();
              setNotice(t("addflow.added", { name }));
            }}
            tabs={tabList}
            counts={counts}
            activeTab={activeTab}
            tabLabel={tabLabel}
            all={list}
            tabRows={tabRows}
            handlers={handlers}
            desktop={DESKTOP}
            onApply={applyFromPalette}
            onJumpTab={navigate}
            onJumpTorrent={jumpTorrent}
            onCreateTab={(query) => void createFromPalette(query)}
            onSheet={() => {
              setPalette(null);
              setSheetOpen(true);
            }}
            onClose={() => setPalette(null)}
          />
        )}
        <input
          ref={pickRef}
          type="file"
          accept=".torrent,application/x-bittorrent"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) setPalette({ input: "", add: { kind: "file", file } });
          }}
        />
        {sheetOpen && <ShortcutSheet desktop={DESKTOP} onClose={() => setSheetOpen(false)} />}
        {removing && (
          <RemoveDialog
            torrents={removing.torrents}
            deleteData={removing.erase}
            onClose={() => setRemoving(null)}
            onRemoved={() => {
              const gone = new Set(removing.torrents.map((row) => row.id));
              setSelection((current) => current.filter((id) => !gone.has(id)));
              if (detailId && gone.has(detailId)) setDetailId(null);
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
                ? prompt.torrents[0].savePath
                : prompt.kind === "rename"
                  ? prompt.torrents[0].name
                  : [...new Set(prompt.torrents.flatMap((row) => row.tags))].join(", ")
            }
            allowEmpty={prompt.kind === "tags"}
            onClose={() => setPrompt(null)}
            onSubmit={async (value) => {
              if (prompt.kind === "relocate") await api.relocate(prompt.torrents[0].id, value);
              else if (prompt.kind === "rename") await api.rename(prompt.torrents[0].id, value);
              else for (const row of prompt.torrents) await api.setTags(row.id, value.split(","));
              refresh();
            }}
          />
        )}
      </Shell>
    </UiContext.Provider>
  );
}
