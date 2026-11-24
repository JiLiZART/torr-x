import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { FilePlus, Files, Funnel, Globe, Hash, Link2, Pin, Save, Search } from "lucide-react";
import { api, type FileHit, type Settings, type Tab, type Torrent } from "@torrentx/api-client";
import { chips, evaluate, topItems } from "@torrentx/query";
import { useUi } from "../lib/context";
import { COMMANDS, QUERY_DEFAULT_ACTIONS, type CommandDef, type Handlers } from "../lib/commands";
import { IS_MAC, keyCaps, usableKeys } from "../lib/keymap";
import { canonical, NO_LENS, type Lens } from "../lib/lens";
import { dropChip, fileResults, paletteMode, pickTorrent, rank, typeInto, type FileResult, type PaletteChip, type PaletteInput, type TorrentRef } from "../lib/palette";
import { percent, rate, rowState, STATE_STYLE, trimMiddle } from "../lib/format";
import { HTTP_URL, isTorrentLink, type AddSource } from "../lib/addFlow";
import { usePreview } from "../lib/preview";
import { AddFlow } from "./AddFlow";
import { Chip } from "./Chip";
import { CommandIcon } from "./CommandIcon";
import { FileCells } from "./detail/FilesSection";
import { KeyCaps } from "./KeyCaps";

interface PaletteProps {
  /** `">"` opens straight into command mode. */
  initial: string;
  tabs: Tab[];
  counts: Record<string, number>;
  activeTab: Tab | undefined;
  tabLabel: (tab: Tab) => string;
  /** The library. */
  all: Torrent[];
  /** Rows matching the active tab's query (no lens): what a filter result counts against. */
  tabRows: Torrent[];
  handlers: Handlers;
  desktop: boolean;
  /** Applies a lens in the active tab, or in the pinned All tab. Never writes a tab. */
  onApply: (lens: Lens, inAll: boolean) => void;
  onJumpTab: (id: string) => void;
  onJumpTorrent: (id: string) => void;
  /** Creates the tab without activating it. */
  onCreateTab: (query: string) => void;
  onSheet: () => void;
  /** Open straight into the add flow (a file dropped on the window, ⌘O). */
  initialAdd?: AddSource;
  settings: Settings | null;
  diskFree: number | null;
  /** A torrent was added: the palette closes, the active tab and lens stay. */
  onAdded: (id: string, name: string) => void;
  /** The torrent whose page is open: file mode (`@ `) starts scoped to it. */
  here?: TorrentRef | null;
  /** Opens the torrent's Files section with the file in view. */
  onOpenFile: (torrentId: string, index: number) => void;
  onError: (e: unknown) => void;
  onClose: () => void;
}

type Kind = "action" | "filter" | "filterAll" | "jump" | "create" | "all" | "add" | "file" | "pick";

interface Row {
  key: string;
  kind: Kind;
  icon: ReactNode;
  title: string;
  sub?: string;
  scope?: string;
  binding?: string;
  meta?: { text: string; className: string };
  disabled?: string | null;
  /** File mode: drawn as the Files section's compact row. */
  file?: FileResult;
  run: () => void;
}

interface Section {
  id: string;
  label?: string;
  right?: string;
  rows: Row[];
}

const MAX_TORRENTS = 6;
const MAX_TABS = 5;
const MAX_PICKS = 20;
const iconBox = (node: ReactNode, tone = "bg-ui-surface-2 text-ui-text-2") => (
  <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] ${tone}`}>{node}</span>
);

/** ⌘T: one surface to jump, filter and act. `>` switches to commands only. */
export function Palette(props: PaletteProps) {
  const { initial, tabs, counts, activeTab, tabLabel, all, tabRows, handlers, desktop, onApply, onJumpTab, onJumpTorrent, onCreateTab, onSheet, initialAdd, settings, diskFree, onAdded, here = null, onOpenFile, onError, onClose } = props;
  const { t, gate } = useUi();
  // Add mode: the same panel grows downward into the add flow; Escape returns to the input.
  const [addSource, setAddSource] = useState<AddSource | null>(initialAdd ?? null);
  const canPreview = !gate("addPreview");
  const previewState = usePreview(addSource, canPreview);
  const [input, setInput] = useState<PaletteInput>(() => typeInto({ chips: [], text: "" }, initial, here));
  const text = input.text;
  const setText = (value: string) => setInput({ ...input, text: value });
  // File mode: every torrent's files, fetched once per palette when file mode is first entered.
  const [hits, setHits] = useState<FileHit[] | null>(null);
  const [cursor, setCursor] = useState({ section: 0, row: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dropping, setDropping] = useState(false);
  const pickFile = () => fileRef.current?.click();
  const addFile = (file: File | undefined) => {
    if (file) setAddSource({ kind: "file", file });
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDropping(false);
    addFile([...e.dataTransfer.files].find((f) => f.name.endsWith(".torrent")));
  };

  // Escape restores focus to whatever had it before the panel opened.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);

  const mode = paletteMode(input);
  const command = mode.kind === "command";
  const plain = input.chips.length === 0;
  const fileMode = mode.kind === "files" || mode.kind === "pickTorrent";
  useEffect(() => {
    if (!fileMode || hits !== null) return;
    let live = true;
    api.files().then(
      (all) => live && setHits(all),
      (e) => {
        if (!live) return;
        setHits([]);
        onError(e);
      },
    );
    return () => {
      live = false;
    };
  }, [fileMode, hits, onError]);
  const tabName = activeTab ? tabLabel(activeTab) : "";
  const now = Date.now() / 1000;

  const scopeLabel = (def: CommandDef) => (def.scope === "tab" ? t("palette.scopeTab", { tab: tabName }) : t(`palette.scope.${def.scope}`));
  const commandRow = (def: CommandDef): Row => {
    const handler = handlers[def.id];
    return {
      key: def.id,
      kind: "action",
      icon: <CommandIcon name={def.icon} size={15} />,
      title: t(`cmd.${def.id}`),
      sub: handler?.disabled ?? undefined,
      scope: scopeLabel(def),
      binding: usableKeys(def.keys, desktop)[0],
      disabled: handler?.disabled,
      run: () => {
        onClose();
        handler?.run();
      },
    };
  };
  const offered = COMMANDS.filter((def) => !def.hidden && handlers[def.id] && !handlers[def.id].unavailable);
  const matchingCommands = (needle: string) => rank(offered, needle, (def) => [t(`cmd.${def.id}`)]);

  const torrentRow = (torrent: Torrent): Row => {
    const state = rowState(torrent);
    const where = torrent.tracker ?? "";
    const context =
      state === "paused"
        ? t("palette.ctx.pausedAt", { p: percent(torrent.progress) })
        : torrent.progress >= 1
          ? `${t("row.done")}${torrent.ratio == null ? "" : ` · ${t("palette.ctx.ratio", { r: torrent.ratio.toFixed(1) })}`}`
          : torrent.downloadRate > 0
            ? `${percent(torrent.progress)} · ${rate(torrent.downloadRate).trim()}`
            : `${t(`state.${state}`)} · ${percent(torrent.progress)}`;
    return {
      key: `t:${torrent.id}`,
      kind: "jump",
      icon: iconBox(<Hash size={14} />),
      title: torrent.name,
      sub: [context, where].filter(Boolean).join(" · "),
      meta: { text: t(`state.${state}`), className: STATE_STYLE[state].badge.split(" ").find((c) => c.startsWith("text-")) ?? "" },
      binding: "Enter",
      run: () => {
        onClose();
        onJumpTorrent(torrent.id);
      },
    };
  };
  const tabRow = (tab: Tab): Row => ({
    key: `tab:${tab.id}`,
    kind: "jump",
    icon: iconBox(tab.pinned ? <Pin size={14} /> : <Hash size={14} />, "bg-ui-surface-2 text-ui-accent"),
    title: tabLabel(tab),
    sub: `${t(tab.pinned ? "palette.kind.pinned" : tab.name ? "palette.kind.smart" : "palette.kind.adhoc")} · ${tab.query || t("zero.everything")}`,
    meta: { text: String(counts[tab.id] ?? 0), className: "text-ui-text-3" },
    binding: "Enter",
    run: () => {
      onClose();
      onJumpTab(tab.id);
    },
  });

  const sections = useMemo((): Section[] => {
    // A pasted magnet link or URL is an add, nothing else.
    const pasted = text.trim();
    if (mode.kind === "pickTorrent") {
      const picks = (mode.text.trim() ? rank(all, mode.text, (row) => [row.name]) : all).slice(0, MAX_PICKS);
      return [
        {
          id: "pick",
          label: t("palette.pickTorrent"),
          right: t("palette.matches", { n: picks.length }),
          rows: picks.map((torrent) => ({
            key: `pick:${torrent.id}`,
            kind: "pick" as Kind,
            icon: iconBox(<Hash size={14} />),
            title: torrent.name,
            sub: t("palette.pickSub"),
            binding: "Enter",
            run: () => setInput(pickTorrent(input, { id: torrent.id, name: torrent.name })),
          })),
        },
      ];
    }
    if (mode.kind === "files") {
      const found = hits ? fileResults(hits, mode) : null;
      if (!found) return [];
      return [
        {
          id: "files",
          label: mode.scope ? t("palette.filesIn", { torrent: trimMiddle(mode.scope.name, 40) }) : t("palette.filesAll"),
          right: found.more > 0 ? t("palette.filesMore", { n: found.more }) : t("palette.matches", { n: found.rows.length }),
          rows: found.rows.map((file) => ({
            key: `file:${file.torrentId}:${file.index}`,
            kind: "file" as Kind,
            icon: null,
            title: file.path,
            file,
            run: () => {
              onClose();
              onOpenFile(file.torrentId, file.index);
            },
          })),
        },
      ];
    }
    if (plain && HTTP_URL.test(pasted)) {
      return [
        {
          id: "add",
          label: t("palette.addSection"),
          rows: [
            {
              key: "add-uri",
              kind: "add" as Kind,
              icon: iconBox(<Link2 size={14} />, "bg-ui-accent-soft text-ui-accent"),
              title: t("palette.addUrl"),
              sub: pasted,
              binding: "Enter",
              run: () => setAddSource({ kind: "uri", uri: pasted }),
            },
          ],
        },
      ];
    }
    if (mode.kind === "command") {
      return [{ id: "actions", label: t("palette.actions"), right: t("palette.actionsHint"), rows: matchingCommands(mode.text).map(commandRow) }];
    }
    if (mode.kind === "jump") {
      const needle = mode.text;
      const jumpTabs = rank(tabs, needle, (tab) => [tabLabel(tab), tab.query], (tab) => (tab.pinned ? 1 : 0)).slice(0, MAX_TABS);
      const jumpTorrents = needle ? rank(all, needle, (row) => [row.name]).slice(0, MAX_TORRENTS) : [];
      const jumps = [...jumpTabs.map(tabRow), ...jumpTorrents.map(torrentRow)];
      const filter: Row[] = needle
        ? [
            {
              key: "filter-name",
              kind: "filter" as Kind,
              icon: iconBox(<Funnel size={14} />),
              title: t("palette.filterName", { text: needle }),
              sub: t("palette.lensIn", { tab: tabName }),
              binding: "Tab",
              run: () => {
                onClose();
                onApply({ fuzzy: needle, query: "" }, false);
              },
            },
          ]
        : [];
      return [
        { id: "jump", label: t("palette.jumpTo"), right: t("palette.matches", { n: jumps.length }), rows: jumps },
        { id: "actions", label: t("palette.actions"), rows: [...filter, ...(needle ? matchingCommands(needle).slice(0, 5).map(commandRow) : [])] },
        {
          id: "all",
          rows: [
            {
              key: "all",
              kind: "all" as Kind,
              icon: <Globe size={14} className="text-ui-text-2" />,
              title: t("palette.allTorrents"),
              scope: t("palette.allHint"),
              run: () => {
                onClose();
                onApply(needle ? { fuzzy: needle, query: "" } : NO_LENS, true);
              },
            },
          ],
        },
      ].filter((s) => s.rows.length > 0);
    }
    // Structured query: grouped sections, never mixed.
    const { ast, text: query } = mode;
    const canon = canonical(query);
    const words = topItems(ast).flatMap((n) => (n.type === "pred" ? [n.value.replace(/\*/g, "")] : []));
    const named = words.flatMap((w) => (w ? matchingCommands(w) : []));
    // The scoped defaults as drawn, then any command whose label matches a typed value.
    const defaults = QUERY_DEFAULT_ACTIONS.map((id) => offered.find((d) => d.id === id)).filter((d): d is CommandDef => !!d);
    const actions = [...new Set([...defaults, ...named])].slice(0, 6);
    const inTab = tabRows.filter((row) => evaluate(ast, row, now)).length;
    const matching = all.filter((row) => evaluate(ast, row, now));
    const savedAs = tabs.find((tab) => canonical(tab.query) === canon);
    const jumpTabs = tabs.filter((tab) => tab.query && (canonical(tab.query) === canon || canonical(tab.query).includes(canon) || canon.includes(canonical(tab.query))));
    const jumps = [...jumpTabs.slice(0, MAX_TABS).map(tabRow), ...matching.slice(0, MAX_TORRENTS).map(torrentRow)];
    return [
      { id: "actions", label: t("palette.actions"), right: t("palette.actionsHint"), rows: actions.map(commandRow) },
      {
        id: "filter",
        label: t("palette.filter"),
        right: t("palette.filterHint"),
        rows: [
          {
            key: "filter",
            kind: "filter" as Kind,
            icon: <Funnel size={15} className="text-ui-accent" />,
            title: canon,
            sub: t("palette.lensMatches", { tab: tabName, n: inTab }),
            binding: "Tab",
            run: () => {
              onClose();
              onApply({ fuzzy: "", query: canon }, false);
            },
          },
          {
            key: "filter-all",
            kind: "filterAll" as Kind,
            icon: <Globe size={15} className="text-ui-text-2" />,
            title: t("palette.inAll", { query: canon }),
            sub: t("palette.inAllHint"),
            binding: "Shift+Enter",
            run: () => {
              onClose();
              onApply({ fuzzy: "", query: canon }, true);
            },
          },
        ],
      },
      { id: "jump", label: t("palette.jumpTo"), right: t("palette.matches", { n: jumps.length }), rows: jumps },
      {
        id: "create",
        label: t("palette.createTab"),
        rows: [
          {
            key: "create",
            kind: "create" as Kind,
            icon: <Save size={15} className="text-ui-accent" />,
            title: savedAs ? t("palette.savedAs", { tab: tabLabel(savedAs) }) : t("palette.save", { query: canon }),
            sub: t("palette.createHint"),
            binding: "Mod+S",
            run: () => {
              onClose();
              if (savedAs) onJumpTab(savedAs.id);
              else onCreateTab(canon);
            },
          },
        ],
      },
    ].filter((s) => s.rows.length > 0);
    // Handlers and labels change every render; recomputing is cheap next to the list itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind, mode.text, input, hits, tabs, counts, all, tabRows, handlers, tabName]);

  const at = sections[Math.min(cursor.section, sections.length - 1)];
  const current = at?.rows[Math.min(cursor.row, at.rows.length - 1)];
  const flat = sections.flatMap((s, si) => s.rows.map((r, ri) => ({ ...r, si, ri })));
  const findRow = (kind: Kind) => flat.find((r) => r.kind === kind);

  useEffect(() => setCursor({ section: 0, row: 0 }), [input]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const runRow = (row: Row | undefined) => {
    if (row && !row.disabled) row.run();
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (addSource) return; // the add flow owns its keys
    const mod = e.metaKey || e.ctrlKey;
    // Escape while picking a torrent drops the pick, not the palette.
    if (e.key === "Escape") {
      if (mode.kind === "pickTorrent") setInput(dropChip(input));
      else onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!at) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setCursor({ section: cursor.section, row: (cursor.row + step + at.rows.length) % at.rows.length });
    } else if (e.key === "Tab") {
      // Jump mode: filter instead. Grouped mode: switch section; on a filter row, apply it.
      const filterRow = findRow("filter");
      if (mode.kind === "jump" && !e.shiftKey) runRow(filterRow);
      else if (!e.shiftKey && current?.kind === "filter") runRow(current);
      else if (sections.length > 0) setCursor({ section: (cursor.section + (e.shiftKey ? -1 : 1) + sections.length) % sections.length, row: 0 });
    } else if (e.key === "Enter") {
      runRow(e.shiftKey && mode.kind === "query" ? findRow("filterAll") : current);
    } else if (mod && e.key.toLowerCase() === "s" && mode.kind === "query") runRow(findRow("create"));
    else if (mod && e.key.toLowerCase() === "k") onSheet();
    else if (mod && e.key.toLowerCase() === "o") pickFile();
    else if (e.key === "Backspace" && !plain && text === "") setInput(dropChip(input));
    else return;
    e.preventDefault();
  };

  // Why the list is empty: loading files, nothing typed yet in file mode, a parse error, or no match.
  const emptyLine =
    fileMode && hits === null
      ? t("palette.filesLoading")
      : mode.kind === "files" && mode.error
        ? mode.error.message
        : mode.kind === "files" && !mode.scope && mode.text.trim() === ""
          ? t("palette.filesHint")
          : t("palette.nothing");

  const hint = (keys: string, label: string) => (
    <span className="flex shrink-0 items-center gap-[5px] whitespace-nowrap">
      <span className="font-code text-[10px] text-ui-text-2">{keys}</span>
      <span className="text-[11px] text-ui-text-3">{label}</span>
    </span>
  );

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal aria-label={t("palette.title")}>
      <button className="absolute inset-0 cursor-default bg-ui-bg/60 backdrop-blur-[7px]" aria-label={t("common.close")} tabIndex={-1} onClick={onClose} />
      <div
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDropping(true);
        }}
        onDragLeave={() => setDropping(false)}
        onDrop={handleDrop}
        className={`absolute left-1/2 top-[96px] flex ${dropping ? "ring-2 ring-ui-accent" : ""} max-h-[calc(100vh-120px)] ${addSource ? "w-[860px]" : "w-[720px]"} max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-[18px] border border-ui-border-strong bg-ui-surface font-ui shadow-[0_24px_60px_rgba(0,0,0,0.66)]`}
      >
        <div className="flex h-[66px] shrink-0 items-center gap-[12px] border-b border-ui-border px-[18px]">
          {command ? (
            <span className="font-code text-[18px] font-semibold text-ui-accent">&gt;</span>
          ) : fileMode ? (
            <Files size={18} className="shrink-0 text-ui-accent" />
          ) : (
            <Search size={18} className="shrink-0 text-ui-text-3" />
          )}
          {!addSource && input.chips.filter((c) => c.kind !== "command").map((chip, i) => <InputChip key={i} chip={chip} />)}
          {addSource ? (
            <span className="flex min-w-0 flex-1 items-center gap-[8px]">
              <span className="min-w-0 flex-1 truncate font-code text-[14px] text-ui-text-2" title={addSource.kind === "file" ? addSource.file.name : addSource.uri}>
                {addSource.kind === "file" ? addSource.file.name : addSource.uri}
              </span>
              <span
                className={`shrink-0 rounded-[6px] px-[7px] py-[3px] font-code text-[10px] ${previewState.preview ? "bg-ui-accent-soft text-ui-accent" : previewState.error ? "bg-ui-red-soft text-ui-red" : "bg-ui-surface-2 text-ui-text-3"}`}
              >
                {previewState.preview
                  ? t("addflow.resolved", { s: (previewState.elapsed / 1000).toFixed(1) })
                  : previewState.error
                    ? t("addflow.failed")
                    : canPreview
                      ? t("addflow.resolvingShort")
                      : t("addflow.noPreviewShort")}
              </span>
            </span>
          ) : (
          <input
            autoFocus
            value={text}
            onChange={(e) => {
              const value = e.target.value;
              if (plain && isTorrentLink(value.trim())) {
                setText(value);
                setAddSource({ kind: "uri", uri: value.trim() });
              } else setInput(typeInto(input, value, here));
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              command
                ? t("palette.placeholderCommand")
                : mode.kind === "pickTorrent"
                  ? t("palette.placeholderPick")
                  : mode.kind === "files"
                    ? mode.scope
                      ? t("palette.placeholderFilesIn")
                      : t("palette.placeholderFiles")
                    : t("palette.placeholder")
            }
            aria-label={t("palette.title")}
            className={`min-w-[120px] flex-1 bg-transparent text-ui-text caret-ui-accent placeholder-ui-text-3 focus:outline-none ${mode.kind === "query" || mode.kind === "files" ? "font-code text-[17px]" : "text-[18px]"}`}
          />
          )}
          {!addSource && plain && text.trim() !== "" && <span className="hidden shrink-0 font-code text-[10px] text-ui-text-3 xl:block">{t("palette.hint")}</span>}
          <button
            type="button"
            data-command="torrent.add"
            onClick={pickFile}
            title={t("palette.addDrop")}
            className="flex shrink-0 items-center gap-[6px] rounded-[9px] border border-dashed border-ui-border-strong px-[10px] py-[6px] text-[12px] text-ui-text-2 hover:border-ui-accent-line hover:text-ui-accent"
          >
            <FilePlus size={13} />
            {t("palette.addFile")}
            <KeyCaps binding="Mod+O" tone="text-ui-text-3" />
          </button>
          <input ref={fileRef} type="file" accept=".torrent,application/x-bittorrent" className="hidden" onChange={(e) => addFile(e.target.files?.[0])} />
        </div>
        {addSource ? (
          <AddFlow
            key={addSource.kind === "file" ? `${addSource.file.name}:${addSource.file.size}` : addSource.uri}
            source={addSource}
            state={previewState}
            canPreview={canPreview}
            library={all}
            settings={settings}
            diskFree={diskFree}
            onAdded={(id, name) => {
              onClose();
              onAdded(id, name);
            }}
            onJump={(id) => {
              onClose();
              onJumpTorrent(id);
            }}
            onCancel={() => {
              setAddSource(null);
              setText("");
            }}
          />
        ) : (
          <>
          {mode.kind === "query" && (
            <div className="flex shrink-0 flex-wrap items-center gap-[8px] border-b border-ui-border bg-ui-chrome-2 px-[18px] py-[9px]">
              <span className="font-code text-[10px] text-ui-text-3">{t("palette.parsesAs")}</span>
              {chips(mode.ast).map((chip, i) => (
                <Chip key={i} chip={chip} />
              ))}
              <span className="flex-1" />
              <span className="font-code text-[10px] text-ui-text-2">{t("palette.ofTotal", { n: all.filter((row) => evaluate(mode.ast, row, now)).length, m: all.length })}</span>
            </div>
          )}
          <div ref={listRef} className="flex min-h-0 flex-col gap-[2px] overflow-y-auto px-[4px] pb-[10px] pt-[6px]" role="listbox">
            {sections.length === 0 && <p className="px-[18px] py-[16px] text-[12px] text-ui-text-3">{emptyLine}</p>}
            {sections.map((section, si) => (
              <div key={section.id} className="flex flex-col gap-[2px]">
                {section.label && (
                  <div className="flex items-center gap-[8px] px-[18px] pb-[6px] pt-[12px] font-code text-[9px] text-ui-text-3">
                    <span className="tracking-[1.2px]">{section.label}</span>
                    <span className="flex-1" />
                    {section.right && <span>{section.right}</span>}
                  </div>
                )}
                {section.rows.map((row, ri) => {
                  const selected = si === cursor.section && ri === cursor.row;
                  const create = row.kind === "create";
                  const all = row.kind === "all";
                  const frame = create
                    ? selected
                      ? "border-ui-accent bg-ui-accent-soft"
                      : "border-ui-accent-line bg-ui-accent-soft"
                    : selected
                      ? "border-ui-border bg-ui-surface-2"
                      : all
                        ? "border-ui-border bg-ui-surface-2/60"
                        : "border-transparent";
                  if (row.file) {
                    const file = row.file;
                    return (
                      <button
                        key={row.key}
                        role="option"
                        aria-selected={selected}
                        aria-label={`${file.path} · ${file.torrentName}`}
                        onMouseMove={() => !selected && setCursor({ section: si, row: ri })}
                        onClick={() => runRow(row)}
                        className={`flex h-[34px] w-full shrink-0 items-center gap-[10px] rounded-[8px] border px-[12px] text-left ${frame}`}
                      >
                        <FileCells row={file} compact torrentName={mode.kind === "files" && mode.scope ? undefined : file.torrentName} />
                      </button>
                    );
                  }
                  return (
                    <button
                      key={row.key}
                      role="option"
                      aria-selected={selected}
                      aria-disabled={!!row.disabled}
                      onMouseMove={() => !selected && setCursor({ section: si, row: ri })}
                      onClick={() => runRow(row)}
                      className={`flex w-full items-center gap-[11px] rounded-[10px] border px-[14px] py-[9px] text-left ${frame} ${row.disabled ? "opacity-50" : ""}`}
                    >
                      <span className={create ? "text-ui-accent" : "text-ui-text-2"}>{row.icon}</span>
                      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                        <span className={`truncate text-[13px] ${create ? "font-semibold text-ui-accent" : "font-medium text-ui-text"} ${row.kind === "filter" && mode.kind === "query" ? "font-code" : ""}`}>{row.title}</span>
                        {row.sub && <span className={`truncate font-code text-[10px] ${row.disabled ? "text-ui-amber" : create ? "text-ui-accent-line" : "text-ui-text-3"}`}>{row.sub}</span>}
                      </span>
                      {row.scope && <span className="shrink-0 font-code text-[10px] text-ui-text-3">{row.scope}</span>}
                      {row.meta && <span className={`shrink-0 font-code text-[10px] ${row.meta.className}`}>{row.meta.text}</span>}
                      {row.binding && <KeyCaps binding={row.binding} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex h-[38px] shrink-0 items-center gap-[14px] border-t border-ui-border bg-ui-chrome-2 px-[16px]">
            {hint("↑↓", t("palette.navigate"))}
            {hint("⏎", mode.kind === "jump" ? t("palette.open") : t("palette.run"))}
            {hint("⇥", mode.kind === "jump" ? t("palette.filterInstead") : t("palette.switchSection"))}
            {hint(keyCaps("Mod+K", IS_MAC).join(IS_MAC ? "" : "+"), t("palette.sheet"))}
            {hint("esc", t("palette.dismiss"))}
            {plain && hint("@ ␣", t("palette.filesShortcut"))}
            <span className="flex-1" />
            <span className="hidden truncate font-code text-[10px] text-ui-text-3 xl:block">{t("palette.brand")}</span>
          </div>
          </>
        )}
      </div>
    </div>
  );
}


/** A chip before the palette input: file mode, the torrent it is scoped to, or a pending `torrent:`. */
function InputChip({ chip }: { chip: PaletteChip }) {
  const { t } = useUi();
  const base = "flex shrink-0 items-center gap-[5px] rounded-[7px] border px-[8px] py-[4px] font-code text-[11px]";
  if (chip.kind === "files") return <span className={`${base} border-ui-accent-line bg-ui-accent-soft text-ui-accent`}>@ {t("palette.chipFiles")}</span>;
  if (chip.kind === "torrentPending") return <span className={`${base} border-dashed border-ui-border-strong text-ui-text-2`}>torrent:</span>;
  if (chip.kind === "torrent") {
    return (
      <span className={`${base} border-ui-border bg-ui-surface-2 text-ui-text`} title={chip.name}>
        <span className="text-ui-text-3">torrent:</span>
        {trimMiddle(chip.name, 24)}
      </span>
    );
  }
  return null;
}
