import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { BookmarkPlus, CornerDownLeft, File as FileIcon, FilePlus, Files, Funnel, Globe, Hash, Link2, ListFilter, Pause, Pencil, Pin, Search, Settings as Cog, Tag } from "lucide-react";
import { api, type FileHit, type Settings, type Tab, type Torrent } from "@torrentx/api-client";
import { chips, evaluate } from "@torrentx/query";
import { useUi } from "../lib/context";
import { COMMANDS, type CommandDef, type Handlers } from "../lib/commands";
import { IS_MAC, keyCaps, usableKeys } from "../lib/keymap";
import { canonical, NO_LENS, type Lens } from "../lib/lens";
import {
  draftCompletion,
  dropChip,
  fileJumps,
  fileResults,
  paletteMode,
  pickTorrent,
  queryWords,
  rank,
  suggestTabName,
  tokenSpans,
  typeInto,
  type FileResult,
  type PaletteChip,
  type PaletteInput,
  type TorrentRef,
} from "../lib/palette";
import { deepLink, parseDeepLink, type SettingsSection } from "../lib/settings";
import { bytes, percent, rate, rowState, STATE_STYLE, trimMiddle } from "../lib/format";
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
  /** Live values offered as completions (`tag:`, `tracker:`). */
  values: Partial<Record<string, string[]>>;
  handlers: Handlers;
  desktop: boolean;
  /** Applies a lens in the active tab, or in the pinned All tab. Never writes a tab. */
  onApply: (lens: Lens, inAll: boolean) => void;
  onJumpTab: (id: string) => void;
  onJumpTorrent: (id: string) => void;
  /** A pasted `tx://settings/<section>` link. */
  onOpenSettings: (section: SettingsSection) => void;
  /** Creates the tab without activating it; an empty name means "named by its query". */
  onCreateTab: (query: string, name: string) => void;
  /** Query mode: pause every matching torrent that is not paused. */
  onPauseMatches: (rows: Torrent[]) => void;
  /** Query mode: open the tag dialog for every matching torrent. */
  onTagMatches: (rows: Torrent[]) => void;
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

type Kind = "action" | "filter" | "filterAll" | "jump" | "create" | "all" | "add" | "file" | "pick" | "complete";

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
/** Query mode: rows shown per section, as drawn. */
const QUERY_TORRENTS = 3;
const QUERY_FILES = 3;
const iconBox = (node: ReactNode, tone = "bg-ui-surface-2 text-ui-text-2") => (
  <span className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] ${tone}`}>{node}</span>
);

/** ⌘T: one surface to jump, filter and act. `>` switches to commands only. */
export function Palette(props: PaletteProps) {
  const { initial, tabs, counts, activeTab, tabLabel, all, values, handlers, desktop, onApply, onJumpTab, onJumpTorrent, onOpenSettings, onCreateTab, onPauseMatches, onTagMatches, onSheet, initialAdd, settings, diskFree, onAdded, here = null, onOpenFile, onError, onClose } = props;
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
  /** null until the user moves it: the default position depends on the mode. */
  const [cursor, setCursor] = useState<{ section: number; row: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  /** The Create row's name, tied to the query it was edited for; a new query brings back the suggestion. */
  const [nameDraft, setNameDraft] = useState<{ query: string; value: string } | null>(null);
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
  // Query mode lists files by name under JUMP TO, so it needs the same one-time fetch.
  const needFiles = fileMode || mode.kind === "query";
  const queryCanon = mode.kind === "query" ? canonical(mode.text) : "";
  const tabNameValue = mode.kind !== "query" ? "" : nameDraft?.query === queryCanon ? nameDraft.value : suggestTabName(mode.text, mode.ast);
  useEffect(() => {
    if (!needFiles || hits !== null) return;
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
  }, [needFiles, hits, onError]);
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
    if (mode.kind === "draft") {
      // An unfinished query: offer what can come next at the end of the input.
      const completion = draftCompletion(text, values);
      return [
        {
          id: "complete",
          label: t("palette.suggestions"),
          rows: completion.options.slice(0, 8).map(
            (option): Row => ({
              key: `c:${option}`,
              kind: "complete",
              icon: iconBox(<CornerDownLeft size={14} />),
              title: option,
              binding: "Tab",
              run: () => {
                setText(text.slice(0, completion.from) + option);
                inputRef.current?.focus();
              },
            }),
          ),
        },
      ].filter((s) => s.rows.length > 0);
    }
    if (mode.kind === "command") {
      return [{ id: "actions", label: t("palette.actions"), right: t("palette.actionsHint"), rows: matchingCommands(mode.text).map(commandRow) }];
    }
    if (mode.kind === "jump") {
      const needle = mode.text;
      const jumpTabs = rank(tabs, needle, (tab) => [tabLabel(tab), tab.query], (tab) => (tab.pinned ? 1 : 0)).slice(0, MAX_TABS);
      const jumpTorrents = needle ? rank(all, needle, (row) => [row.name]).slice(0, MAX_TORRENTS) : [];
      const link = parseDeepLink(needle);
      const settingsRow: Row[] = link
        ? [
            {
              key: "settings-link",
              kind: "jump",
              icon: iconBox(<Cog size={14} />, "bg-ui-surface-2 text-ui-accent"),
              title: `${t("set.title")} / ${t(`set.section.${link}`)}`,
              sub: deepLink(link),
              binding: "Enter",
              run: () => {
                onClose();
                onOpenSettings(link);
              },
            },
          ]
        : [];
      const jumps = [...settingsRow, ...jumpTabs.map(tabRow), ...jumpTorrents.map(torrentRow)];
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
    // Structured query: save it, see what it matches, act on exactly those matches.
    const { ast } = mode;
    const canon = canonical(mode.text);
    const matching = all.filter((row) => evaluate(ast, row, now));
    const savedAs = tabs.find((tab) => canonical(tab.query) === canon);
    const words = queryWords(ast);
    const jumpTabs = tabs.filter((tab) => {
      if (!tab.query) return false;
      const q = canonical(tab.query);
      const hay = `${tabLabel(tab)} ${tab.query}`.toLowerCase();
      return q.includes(canon) || canon.includes(q) || words.some((w) => hay.includes(w));
    });
    const jumpFiles = hits ? fileJumps(hits, words, QUERY_FILES) : [];
    const jumps: Row[] = [
      ...jumpTabs.slice(0, MAX_TABS).map((tab) => ({ ...tabRow(tab), meta: { text: t("palette.metaTab"), className: "text-ui-text-3" }, binding: undefined })),
      ...jumpFiles.map(
        (file): Row => ({
          key: `jf:${file.torrentId}:${file.index}`,
          kind: "jump",
          icon: iconBox(<FileIcon size={14} />),
          title: file.name,
          sub: t("palette.fileIn", { torrent: trimMiddle(file.torrentName, 48) }),
          meta: { text: t("palette.metaFile"), className: "text-ui-text-3" },
          run: () => {
            onClose();
            onOpenFile(file.torrentId, file.index);
          },
        }),
      ),
    ];
    const none = matching.length === 0 ? t("palette.noMatches") : null;
    const torrentResult = (torrent: Torrent): Row => ({
      ...torrentRow(torrent),
      sub: [bytes(torrent.size), torrent.ratio == null ? null : t("palette.ctx.ratio", { r: torrent.ratio.toFixed(2) }), torrent.tracker].filter(Boolean).join(" · "),
    });
    return [
      {
        id: "create",
        label: t("palette.createFromQuery"),
        right: t("palette.recommended"),
        rows: [
          {
            key: "create",
            kind: "create" as Kind,
            icon: iconBox(<BookmarkPlus size={14} />, "bg-ui-accent-line text-ui-accent"),
            title: savedAs ? t("palette.savedAs", { tab: tabLabel(savedAs) }) : t("palette.saveSmart"),
            sub: t("palette.saveSmartHint"),
            binding: "Mod+S",
            run: () => {
              onClose();
              if (savedAs) onJumpTab(savedAs.id);
              else onCreateTab(canon, tabNameValue.trim());
            },
          },
        ],
      },
      {
        id: "results",
        label: t("palette.filterResults"),
        right: t("palette.matches", { n: matching.length }),
        rows: [
          ...matching.slice(0, QUERY_TORRENTS).map(torrentResult),
          {
            key: "filter-all",
            kind: "filterAll" as Kind,
            icon: iconBox(<ListFilter size={14} />),
            title: t("palette.showAll", { n: matching.length }),
            sub: t("palette.showAllHint"),
            binding: "Shift+Enter",
            run: () => {
              onClose();
              onApply({ fuzzy: "", query: canon }, true);
            },
          },
        ],
      },
      { id: "jump", label: t("palette.jumpTo"), right: t("palette.nameMatches", { n: jumps.length }), rows: jumps },
      {
        id: "actions",
        label: t("palette.actions"),
        right: t("palette.actionsOnMatches", { n: matching.length }),
        rows: [
          {
            key: "pause-matches",
            kind: "action" as Kind,
            icon: iconBox(<Pause size={14} />),
            title: t("palette.pauseMatches"),
            sub: none ?? undefined,
            binding: "Mod+P",
            disabled: none,
            run: () => {
              onClose();
              onPauseMatches(matching);
            },
          },
          {
            key: "tag-matches",
            kind: "action" as Kind,
            icon: iconBox(<Tag size={14} />),
            title: t("palette.tagMatches"),
            sub: none ?? undefined,
            binding: "Mod+L",
            disabled: none,
            run: () => {
              onClose();
              onTagMatches(matching);
            },
          },
        ],
      },
    ].filter((s) => s.rows.length > 0);
    // Handlers and labels change every render; recomputing is cheap next to the list itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode.kind, mode.text, input, hits, tabs, counts, all, values, handlers, tabName, tabNameValue]);

  const flat = sections.flatMap((s, si) => s.rows.map((r, ri) => ({ ...r, si, ri })));
  const findRow = (kind: Kind) => flat.find((r) => r.kind === kind);
  // No cursor yet (fresh input): query mode starts on the first matching torrent, so ⏎ opens it.
  const firstTorrent = mode.kind === "query" ? flat.find((r) => r.key.startsWith("t:")) : undefined;
  const pos = cursor ?? (firstTorrent ? { section: firstTorrent.si, row: firstTorrent.ri } : { section: 0, row: 0 });
  const at = sections[Math.min(pos.section, sections.length - 1)];
  const current = at?.rows[Math.min(pos.row, at.rows.length - 1)];

  useEffect(() => setCursor(null), [input]);
  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const runRow = (row: Row | undefined) => {
    if (row && !row.disabled) row.run();
  };
  const queryMode = mode.kind === "query";
  /** Keeps the token layer scrolled with a long input. */
  const syncMirror = () => {
    if (mirrorRef.current && inputRef.current) mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  };
  useEffect(syncMirror);
  const applyLens = () => {
    if (mode.kind !== "query") return;
    onClose();
    onApply({ fuzzy: "", query: canonical(mode.text) }, false);
  };
  /** Query mode: the keys every focused field inside the panel shares. Returns false when the key is not one. */
  const queryKey = (e: KeyboardEvent<HTMLInputElement>): boolean => {
    const mod = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();
    if (mod && key === "s") runRow(findRow("create"));
    else if (mod && key === "p") runRow(flat.find((r) => r.key === "pause-matches"));
    else if (mod && key === "l") runRow(flat.find((r) => r.key === "tag-matches"));
    else if (e.key === "Enter" && e.shiftKey) runRow(findRow("filterAll"));
    else return false;
    return true;
  };
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (addSource) return; // the add flow owns its keys
    const mod = e.metaKey || e.ctrlKey;
    if (queryMode && queryKey(e)) {
      e.preventDefault();
      return;
    }
    // Escape while picking a torrent drops the pick, not the palette.
    if (e.key === "Escape") {
      if (mode.kind === "pickTorrent") setInput(dropChip(input));
      else onClose();
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!at) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      if (queryMode) {
        // One cursor over every row, across sections.
        const i = flat.findIndex((r) => r.si === pos.section && r.ri === Math.min(pos.row, at.rows.length - 1));
        const next = flat[(i + step + flat.length) % flat.length];
        setCursor({ section: next.si, row: next.ri });
      } else setCursor({ section: pos.section, row: (pos.row + step + at.rows.length) % at.rows.length });
    } else if (e.key === "Tab") {
      // Jump mode: filter instead. Query mode: lens in the active tab. Otherwise: switch section.
      if (mode.kind === "jump" && !e.shiftKey) runRow(findRow("filter"));
      else if (mode.kind === "draft") runRow(current);
      else if (queryMode && !e.shiftKey) applyLens();
      else if (sections.length > 0) setCursor({ section: (pos.section + (e.shiftKey ? -1 : 1) + sections.length) % sections.length, row: 0 });
    } else if (e.key === "Enter") runRow(current);
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
          <span className="relative flex min-w-[120px] flex-1 items-center">
          {queryMode && (
            // Query tokens: drawn behind the input in the same font, so the native caret and selection line up.
            <div ref={mirrorRef} aria-hidden className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre font-code text-[17px]">
              {tokenSpans(text).map((span, i) => (
                <span key={i} className={span.kind === "field" ? "text-ui-text-3" : span.kind === "value" ? "text-ui-accent" : "text-ui-text"}>
                  {span.text}
                </span>
              ))}
            </div>
          )}
          <input
            ref={inputRef}
            autoFocus
            value={text}
            onScroll={syncMirror}
            onSelect={syncMirror}
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
            className={`relative w-full bg-transparent caret-ui-accent placeholder-ui-text-3 focus:outline-none ${queryMode ? "text-transparent selection:bg-ui-accent/25" : "text-ui-text"} ${queryMode || mode.kind === "files" || mode.kind === "draft" ? "font-code text-[17px]" : "text-[18px]"}`}
          />
          </span>
          )}
          {!addSource && plain && !queryMode && mode.kind !== "draft" && text.trim() !== "" && <span className="hidden shrink-0 font-code text-[10px] text-ui-text-3 xl:block">{t("palette.hint")}</span>}
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
          {mode.kind === "draft" && mode.error && (
            <div className="flex shrink-0 flex-wrap items-center gap-[8px] border-b border-ui-border bg-ui-chrome-2 px-[18px] py-[9px]">
              <span className="font-code text-[10px] text-ui-text-3">{t("palette.parsesAs")}</span>
              <span className="font-code text-[11px] text-ui-red">
                {mode.error.message}
                {mode.error.suggestion ? ` — ${t("filter.didYouMean", { suggestion: mode.error.suggestion })}` : ""}
              </span>
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
                  const selected = si === pos.section && ri === Math.min(pos.row, section.rows.length - 1);
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
                  if (create && queryMode) {
                    // A div, not a button: it holds the editable tab name.
                    return (
                      <div
                        key={row.key}
                        role="option"
                        aria-selected={selected}
                        onMouseMove={() => !selected && setCursor({ section: si, row: ri })}
                        onClick={() => runRow(row)}
                        className={`flex w-full cursor-pointer items-center gap-[11px] rounded-[10px] border px-[14px] py-[10px] text-left ${frame}`}
                      >
                        {row.icon}
                        <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
                          <span className="truncate text-[13px] font-semibold text-ui-accent">{row.title}</span>
                          <span className="truncate font-code text-[10px] text-ui-accent-line">{row.sub}</span>
                        </span>
                        <label onClick={(e) => e.stopPropagation()} className="flex w-[190px] shrink-0 cursor-text items-center gap-[6px] rounded-[8px] border border-ui-accent-line bg-ui-surface px-[9px] py-[6px]">
                          <input
                            ref={nameRef}
                            value={tabNameValue}
                            onChange={(e) => setNameDraft({ query: queryCanon, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (queryKey(e)) e.preventDefault();
                              else if (e.key === "Enter") {
                                e.preventDefault();
                                runRow(row);
                              } else if (e.key === "Escape" || e.key === "ArrowUp" || e.key === "ArrowDown") {
                                e.preventDefault();
                                inputRef.current?.focus();
                              }
                            }}
                            placeholder={t("palette.tabNamePlaceholder")}
                            aria-label={t("palette.tabName")}
                            className="min-w-0 flex-1 bg-transparent text-[12px] text-ui-text placeholder-ui-text-3 focus:outline-none"
                          />
                          <Pencil size={11} className="shrink-0 text-ui-text-3" />
                        </label>
                        {row.binding && <KeyCaps binding={row.binding} />}
                      </div>
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
                        <span className={`truncate text-[13px] ${create ? "font-semibold text-ui-accent" : "font-medium text-ui-text"} ${(row.kind === "filter" && mode.kind === "query") || row.kind === "complete" ? "font-code" : ""}`}>{row.title}</span>
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
            {queryMode ? (
              <>
                {hint("⏎", t("palette.open"))}
                {hint(keyCaps("Mod+S", IS_MAC).join(IS_MAC ? "" : "+"), t("palette.saveAsTab"))}
                {hint("⇧⏎", t("palette.showAllKey"))}
                {hint("⇥", t("palette.lensKey"))}
              </>
            ) : mode.kind === "draft" ? (
              hint("⏎ ⇥", t("palette.completeKey"))
            ) : (
              <>
                {hint("⏎", mode.kind === "jump" ? t("palette.open") : t("palette.run"))}
                {hint("⇥", mode.kind === "jump" ? t("palette.filterInstead") : t("palette.switchSection"))}
                {hint(keyCaps("Mod+K", IS_MAC).join(IS_MAC ? "" : "+"), t("palette.sheet"))}
              </>
            )}
            {hint("esc", t("palette.dismiss"))}
            {plain && !queryMode && mode.kind !== "draft" && hint("@ ␣", t("palette.filesShortcut"))}
            {plain && !queryMode && mode.kind !== "draft" && hint(":", t("palette.fieldsShortcut"))}
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
