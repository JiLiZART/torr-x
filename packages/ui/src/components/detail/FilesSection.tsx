import { useEffect, useMemo, useState, type ReactElement } from "react";
import { Cast, ChevronDown, ChevronRight, ClipboardCopy, Eye, ExternalLink, Film, Folder, FolderOpen, FolderTree, HardDriveDownload, LayoutList, Library, Play, Tv } from "lucide-react";
import { api, type FileInfo, type TorrentDetails } from "@torrentx/api-client";
import { compare, evaluate, FILE_PRIORITIES, FILE_SCOPE, parse, sortKeys } from "@torrentx/query";
import { useUi } from "../../lib/context";
import { bytes, trimMiddle } from "../../lib/format";
import { clickSort } from "../../lib/lens";
import { FILE_ACTIONS, fileActionBlock, fileClass, fileRow, fileTree, joinPath, treeLines, type FileAction, type FilePriorityWord, type FileRow, type TreeDir } from "../../lib/detail";
import { FileIcon } from "./FileIcon";
import { episodeCode, episodeState, mediaEpisodes, type EpisodeFile } from "../../lib/media";
import { MiniFilterBar } from "./MiniFilterBar";
import { MiniBar, SectionEmpty, TableHeader } from "./Table";

interface FilesSectionProps {
  d: TorrentDetails;
  query: string;
  onQuery: (query: string) => void;
  onError: (e: unknown) => void;
  onNotice: (message: string) => void;
  /** A file opened from the palette: scrolled into view and highlighted briefly. */
  focusFile?: number | null;
  onFocused?: () => void;
}

const FOCUS_MS = 2000;

const ACTION_ICON: Record<FileAction, typeof Play> = {
  play: Play,
  library: Library,
  cast: Cast,
  contents: Eye,
  mount: HardDriveDownload,
  open: ExternalLink,
  reveal: FolderOpen,
  copyPath: ClipboardCopy,
};
const PRIORITY_TONE: Record<FilePriorityWord, string> = { high: "text-ui-amber", normal: "text-ui-text-2", low: "text-ui-text-3", skip: "text-ui-text-3 line-through" };
const STATE_TONE = { ready: "text-ui-accent", downloading: "text-ui-cyan", queued: "text-ui-text-3", skipped: "text-ui-text-3" };
const VIEW_KEY = (id: string) => `tx-files-view:${id}`;
const small = "rounded-[6px] border border-ui-border bg-ui-surface-2 p-[5px] text-ui-text-2 hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-40";

/** The browser runs on the machine that runs TorrentX: open / reveal can work. */
const isLocal = () => ["localhost", "127.0.0.1", "[::1]", "::1"].includes(window.location.hostname) || "__TAURI_INTERNALS__" in window;

export function FilesSection({ d, query, onQuery, onError, onNotice, focusFile = null, onFocused }: FilesSectionProps) {
  const { t, gate, caps } = useUi();
  useEffect(() => {
    if (focusFile === null) return;
    document.getElementById(`file-${focusFile}`)?.scrollIntoView({ block: "center" });
    const timer = setTimeout(() => onFocused?.(), FOCUS_MS);
    return () => clearTimeout(timer);
  }, [focusFile, onFocused]);
  const engine = caps?.engine ?? "";
  const rows = useMemo(() => d.files.map(fileRow), [d.files]);
  const byIndex = useMemo(() => new Map(rows.map((r) => [r.index, r])), [rows]);
  const episodes = useMemo(() => mediaEpisodes(d.files), [d.files]);
  type View = "tree" | "list" | "media";
  const [view, setViewState] = useState<View>(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY(d.id));
      return saved === "media" || saved === "list" ? saved : "tree";
    } catch {
      return "tree";
    }
  });
  // Folders the user folded, by path; a file opened from the palette unfolds the folders above it.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // A file opened from the palette is shown in the list, where every file has a row.
  const media = view === "media" && episodes !== null && focusFile === null;
  const setView = (next: View) => {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY(d.id), next);
    } catch {
      // per-viewer convenience only
    }
  };

  const ast = parse(query, FILE_SCOPE).ast;
  // No sort chip: the torrent's own file order.
  const shown = useMemo(() => {
    if (!ast) return rows;
    const kept = rows.filter((r) => evaluate(ast, r));
    return sortKeys(ast).length > 0 ? kept.sort(compare(sortKeys(ast), FILE_SCOPE)) : kept;
  }, [rows, ast]);
  const shownSet = new Set(shown.map((r) => r.index));
  const skipHint = gate("fileSkip");
  const priorityHint = gate("filePriority");
  const local = isLocal();
  const hasVideo = rows.some((r) => fileClass(r.ext) === "video");

  const setPriority = (row: FileRow, word: FilePriorityWord) => {
    const change = word === "skip" ? { wanted: false } : { wanted: true, ...(priorityHint ? {} : { priority: word }) };
    api.setFiles(d.id, [row.index], change).catch(onError);
  };
  const toggleWanted = (row: FileRow) => api.setFiles(d.id, [row.index], { wanted: row.priority === "skip" }).catch(onError);
  const setDirPriority = (dir: TreeDir, word: FilePriorityWord) => {
    const change = word === "skip" ? { wanted: false } : { wanted: true, ...(priorityHint ? {} : { priority: word }) };
    api.setFiles(d.id, dir.indices, change).catch(onError);
  };
  const toggleDir = (dir: TreeDir) => api.setFiles(d.id, dir.indices, { wanted: dir.wanted !== "all" }).catch(onError);
  const fold = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const blockHint = (action: FileAction, done: boolean) => {
    const why = fileActionBlock(action, { openFile: gate("openFile"), local, done });
    if (!why) return undefined;
    return why === "engine" ? t("caps.notSupported", { engine }) : t(`detail.block.${why}`);
  };
  const runAction = (action: FileAction, file: Pick<FileInfo, "index" | "path">) => {
    if (action === "open") api.openFile(d.id, file.index).catch(onError);
    else if (action === "reveal") api.revealFile(d.id, file.index).catch(onError);
    else if (action === "copyPath") {
      void navigator.clipboard.writeText(joinPath(d.savePath, file.path)).then(() => onNotice(t("detail.pathCopied")), onError);
    }
  };
  const actionButtons = (row: Pick<FileRow, "index" | "path" | "ext" | "done">) =>
    FILE_ACTIONS[fileClass(row.ext)].map((action) => {
      const Icon = ACTION_ICON[action];
      const hint = blockHint(action, row.done >= 100);
      return (
        <button key={action} className={small} disabled={!!hint} title={hint ?? t(`detail.action.${action}`)} aria-label={t(`detail.action.${action}`)} onClick={() => runAction(action, row)}>
          <Icon size={13} />
        </button>
      );
    });

  const switcher = (
    <>
      <span className={`font-code text-[10px] ${media ? "text-ui-accent" : "text-ui-text-3"}`}>{t(media ? "detail.formatMedia" : hasVideo ? "detail.formatVideo" : "detail.formatGeneric")}</span>
      {(
        [
          ["tree", FolderTree, "detail.treeView"],
          ["list", LayoutList, "detail.listView"],
          ...(episodes ? [["media", Tv, "detail.mediaView"] as const] : []),
        ] as const
      ).map(([mode, ModeIcon, label]) => {
        const on = mode === "media" ? media : !media && view === mode;
        return (
          <button
            key={mode}
            onClick={() => setView(mode)}
            aria-pressed={on}
            className={`flex items-center gap-[6px] rounded-[8px] border px-[9px] py-[6px] text-[11px] ${on ? "border-ui-accent-line bg-ui-accent-soft font-medium text-ui-accent" : "border-ui-border bg-ui-surface-2 text-ui-text-2"}`}
          >
            <ModeIcon size={12} /> {t(label)}
          </button>
        );
      })}
    </>
  );

  const fileLine = (row: FileRow, depth?: number) => {
    const focused = row.index === focusFile;
    return (
      <div
        key={row.index}
        id={`file-${row.index}`}
        className={`flex items-center gap-[10px] rounded-[8px] px-[8px] py-[8px] hover:bg-ui-surface-2 ${focused ? "bg-ui-accent-soft ring-1 ring-ui-accent-line" : ""}`}
      >
        <input
          type="checkbox"
          className="h-[15px] w-[15px] shrink-0 accent-ui-accent"
          checked={row.priority !== "skip"}
          disabled={!!skipHint}
          title={skipHint}
          aria-label={t("detail.wanted", { name: row.name })}
          onChange={() => void toggleWanted(row)}
        />
        <FileCells row={row} depth={depth} />
        <select
          className={`w-[104px] shrink-0 rounded-[6px] border border-ui-border bg-ui-surface-2 px-[7px] py-[4px] font-code text-[10px] focus:outline-none ${PRIORITY_TONE[row.priority]}`}
          value={row.priority}
          aria-label={t("detail.col.priority")}
          onChange={(e) => setPriority(row, e.target.value as FilePriorityWord)}
        >
          {FILE_PRIORITIES.map((p) => (
            <option key={p} value={p} disabled={p === "skip" ? !!skipHint : !!priorityHint && p !== row.priority}>
              {t(`detail.priority.${p}`)}
            </option>
          ))}
        </select>
        <span className="flex w-[110px] shrink-0 items-center gap-[5px]">{actionButtons(row)}</span>
      </div>
    );
  };
  const dirLine = (dir: TreeDir, depth: number) => {
    const folded = open.has(dir.path);
    const priorities = new Set(dir.indices.map((i) => byIndex.get(i)!.priority));
    const priority = priorities.size === 1 ? [...priorities][0] : "";
    return (
      <div key={`dir:${dir.path}`} className="flex items-center gap-[10px] rounded-[8px] px-[8px] py-[8px] hover:bg-ui-surface-2">
        <input
          type="checkbox"
          className="h-[15px] w-[15px] shrink-0 accent-ui-accent"
          checked={dir.wanted !== "none"}
          ref={(el) => {
            if (el) el.indeterminate = dir.wanted === "some";
          }}
          disabled={!!skipHint}
          title={skipHint}
          aria-label={t("detail.wanted", { name: dir.name })}
          onChange={() => void toggleDir(dir)}
        />
        <button className="flex min-w-0 flex-1 items-center gap-[6px] text-left" style={{ paddingLeft: depth * 18 }} onClick={() => fold(dir.path)} aria-expanded={!folded}>
          {folded ? <ChevronRight size={12} className="shrink-0 text-ui-text-3" /> : <ChevronDown size={12} className="shrink-0 text-ui-text-3" />}
          {folded ? <Folder size={13} className="shrink-0 text-ui-amber" /> : <FolderOpen size={13} className="shrink-0 text-ui-amber" />}
          <span className="min-w-0 truncate font-code text-[11px] font-medium text-ui-text" title={dir.path}>
            {dir.name}
          </span>
          <span className="shrink-0 rounded-[5px] bg-ui-surface-3 px-[5px] font-code text-[9px] text-ui-text-3">{dir.indices.length}</span>
        </button>
        <span className="w-[80px] shrink-0 text-right font-code text-[11px] text-ui-text-2">{bytes(dir.size)}</span>
        <span className="w-[130px] shrink-0">
          <MiniBar value={dir.done} tone={dir.wanted === "none" ? "bg-ui-text-3" : "bg-ui-accent"} />
        </span>
        <select
          className={`w-[104px] shrink-0 rounded-[6px] border border-ui-border bg-ui-surface-2 px-[7px] py-[4px] font-code text-[10px] focus:outline-none ${priority ? PRIORITY_TONE[priority] : "text-ui-text-3"}`}
          value={priority}
          aria-label={t("detail.col.priority")}
          onChange={(e) => setDirPriority(dir, e.target.value as FilePriorityWord)}
        >
          {!priority && <option value="">{t("detail.priority.mixed")}</option>}
          {FILE_PRIORITIES.map((p) => (
            <option key={p} value={p} disabled={p === "skip" ? !!skipHint : !!priorityHint}>
              {t(`detail.priority.${p}`)}
            </option>
          ))}
        </select>
        <span className="w-[110px] shrink-0" />
      </div>
    );
  };
  // The tree shows when chosen and the files have folders; a flat torrent reads the same as the list.
  const tree = !media && view === "tree" && rows.some((r) => r.path.includes("/")) ? fileTree(shown) : null;
  const focusPath = focusFile === null ? null : byIndex.get(focusFile)?.path;
  // Folded folders, minus the ones above a file opened from the palette.
  const open = focusPath ? new Set([...collapsed].filter((p) => !focusPath.startsWith(`${p}/`))) : collapsed;

  const columns = [
    { field: "name", label: t("detail.col.name"), className: "min-w-0 flex-1 text-left" },
    { field: "size", label: t("detail.col.size"), className: "w-[80px] shrink-0 text-right" },
    { field: "done", label: t("detail.col.done"), className: "w-[130px] shrink-0 text-right" },
    { field: "priority", label: t("detail.col.priority"), className: "w-[104px] shrink-0 text-left" },
    { label: t("detail.col.actions"), className: "w-[110px] shrink-0 text-left" },
  ];

  return (
    <>
      <MiniFilterBar
        scope={FILE_SCOPE}
        query={query}
        onQuery={onQuery}
        placeholder={t("detail.filterFiles")}
        count={t("detail.count.files", { n: shown.length, m: rows.length })}
        values={{ ext: [...new Set(rows.map((r) => r.ext).filter(Boolean))].sort() }}
      >
        {switcher}
      </MiniFilterBar>
      {media ? (
        <MediaView d={d} episodes={episodes!} shown={shownSet} query={query} actionButtons={actionButtons} />
      ) : (
        <>
          <TableHeader columns={columns} sort={ast ? sortKeys(ast)[0] : undefined} onSort={(field) => onQuery(clickSort(query, [], field, FILE_SCOPE))} lead={<span className="w-[15px] shrink-0" />} />
          <div className="flex flex-col gap-[1px] px-[14px] py-[8px]">
            {shown.length === 0 && <SectionEmpty>{rows.length === 0 ? t("detail.empty.files") : t("detail.empty.lens")}</SectionEmpty>}
            {tree
              ? treeLines(tree, open).map(({ node, depth }) => (node.kind === "dir" ? dirLine(node, depth) : fileLine(node.row, depth)))
              : shown.map((row) => fileLine(row))}
          </div>
        </>
      )}
    </>
  );
}

interface FileCellsProps {
  row: FileRow;
  /** The palette's one-line form: middle-trimmed name, optional torrent name, priority word. */
  compact?: boolean;
  /** Compact only: shown when the search is not scoped to one torrent. */
  torrentName?: string;
  /** Tree view: indent by depth and show the file name instead of the path. */
  depth?: number;
}

/** The Files section's row cells: icon, name, size, done. Shared with the palette's file results. */
export function FileCells({ row, compact = false, torrentName, depth }: FileCellsProps) {
  const { t } = useUi();
  const done = <MiniBar value={row.done} tone={row.priority === "skip" ? "bg-ui-text-3" : "bg-ui-accent"} />;
  if (!compact) {
    return (
      <>
        <span className="flex min-w-0 flex-1 items-center gap-[6px]" style={depth === undefined ? undefined : { paddingLeft: depth * 18 + 18 }}>
          <FileIcon ext={row.ext} />
          <span className="min-w-0 truncate font-code text-[11px] text-ui-text" title={row.path}>
            {depth === undefined ? row.path : row.name}
          </span>
        </span>
        <span className="w-[80px] shrink-0 text-right font-code text-[11px] text-ui-text-2">{bytes(row.size)}</span>
        <span className="w-[130px] shrink-0">{done}</span>
      </>
    );
  }
  const where = torrentName ? `${torrentName} · ${row.path}` : row.path;
  return (
    <>
      <FileIcon ext={row.ext} />
      <span className="min-w-0 flex-1 overflow-hidden whitespace-nowrap font-code text-[11px] text-ui-text" title={where}>
        {trimMiddle(row.name, torrentName === undefined ? COMPACT_NAME_WIDE : COMPACT_NAME)}
      </span>
      {torrentName !== undefined && (
        <span className="w-[170px] shrink-0 overflow-hidden whitespace-nowrap font-code text-[10px] text-ui-text-3" title={torrentName}>
          {trimMiddle(torrentName, COMPACT_TORRENT)}
        </span>
      )}
      <span className="w-[64px] shrink-0 whitespace-nowrap text-right font-code text-[10px] text-ui-text-2">{bytes(row.size)}</span>
      <span className="w-[90px] shrink-0">{done}</span>
      <span className={`w-[52px] shrink-0 whitespace-nowrap font-code text-[10px] ${PRIORITY_TONE[row.priority]}`}>{t(`detail.priority.${row.priority}`)}</span>
    </>
  );
}

/** Compact cells, in monospace characters, sized to the palette width (with and without the torrent column). */
const COMPACT_NAME = 34;
const COMPACT_NAME_WIDE = 60;
const COMPACT_TORRENT = 24;

interface MediaViewProps {
  d: TorrentDetails;
  episodes: EpisodeFile<FileInfo>[];
  /** File indices the section lens lets through. */
  shown: Set<number>;
  query: string;
  actionButtons: (row: Pick<FileRow, "index" | "path" | "ext" | "done">) => ReactElement[];
}

/** Files as episodes: season picker, a strip that mirrors the lens, and one row per episode. */
function MediaView({ d, episodes, shown, query, actionButtons }: MediaViewProps) {
  const { t } = useUi();
  const seasons = [...new Set(episodes.map((e) => e.season))];
  const [season, setSeason] = useState(seasons[0]);
  const inSeason = episodes.filter((e) => e.season === season);
  const visible = inSeason.filter((e) => shown.has(e.file.index));
  const active = d.status === "downloading" || d.status === "seeding";
  const featured = visible.find((e) => episodeState(e.file, active) === "ready");
  const lensText = query.replace(/\s*sort:\S+(\s+(asc|desc))?/gi, "").trim();

  return (
    <>
      <div className="flex flex-wrap items-center gap-[10px] border-b border-ui-border px-[14px] py-[11px]">
        <span className="font-code text-[9px] tracking-[1.2px] text-ui-text-3">{t("detail.season")}</span>
        {seasons.map((s) => (
          <button
            key={s}
            onClick={() => setSeason(s)}
            className={`rounded-[7px] border px-[10px] py-[5px] font-code text-[11px] font-medium ${s === season ? "border-ui-accent-line bg-ui-accent-soft text-ui-accent" : "border-ui-border bg-ui-surface-2 text-ui-text-2"}`}
          >
            S{String(s).padStart(2, "0")}
          </button>
        ))}
        <span className="h-[18px] w-px bg-ui-border" />
        <span className="font-code text-[9px] tracking-[1.2px] text-ui-text-3">{t("detail.episodes")}</span>
        <span className="flex flex-wrap items-center gap-[4px]">
          {inSeason.map((e) => {
            const hidden = !shown.has(e.file.index);
            return (
              <a
                key={e.file.index}
                href={hidden ? undefined : `#ep-${e.file.index}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  if (!hidden) document.getElementById(`ep-${e.file.index}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
                }}
                title={hidden ? t("detail.hiddenByLens") : episodeCode(e)}
                className={`flex h-[26px] w-[26px] items-center justify-center rounded-[7px] border font-code text-[10px] ${hidden ? "border-dashed border-ui-border text-ui-text-3" : "border-ui-border bg-ui-surface-2 text-ui-text hover:border-ui-accent-line"}`}
              >
                {e.ep}
              </a>
            );
          })}
        </span>
        {lensText && visible.length < inSeason.length && <span className="font-code text-[9px] text-ui-text-3">{t("detail.dashed", { lens: lensText })}</span>}
        <span className="flex-1" />
        {featured && (
          <button disabled title={t("detail.block.notYet")} className="flex items-center gap-[6px] rounded-[8px] bg-ui-accent px-[12px] py-[7px] text-[12px] font-semibold text-ui-bg disabled:opacity-50">
            <Play size={13} /> {t("detail.playEpisode", { code: episodeCode(featured) })}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-[6px] px-[14px] py-[12px]">
        {visible.length === 0 && <SectionEmpty>{t("detail.empty.lens")}</SectionEmpty>}
        {visible.map((e) => {
          const state = episodeState(e.file, active);
          const isFeatured = e === featured;
          const done = Math.floor(e.file.progress * 100);
          return (
            <div
              key={e.file.index}
              id={`ep-${e.file.index}`}
              className={`flex items-center gap-[12px] rounded-[10px] border px-[10px] py-[9px] ${isFeatured ? "border-ui-accent-line bg-ui-surface-2" : "border-ui-border"}`}
            >
              <span className="flex h-[44px] w-[76px] shrink-0 items-center justify-center rounded-[7px] bg-ui-surface-3 text-ui-text-3">
                <Film size={18} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
                <div className="flex items-center gap-[8px]">
                  <span className="rounded-[5px] bg-ui-surface-3 px-[6px] py-[2px] font-code text-[10px] text-ui-text-2">{episodeCode(e)}</span>
                  {/* Only what the file name says: no invented titles or durations. */}
                  {e.title && <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ui-text">{e.title}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-[8px]">
                  {e.quality.map((q) => (
                    <span key={q} className="rounded-[4px] border border-ui-border px-[5px] py-[2px] font-code text-[9px] text-ui-text-3">
                      {q}
                    </span>
                  ))}
                  <span className="font-code text-[10px] text-ui-text-2">{bytes(e.file.size)}</span>
                  <span className="w-[150px]">
                    <MiniBar value={e.file.progress * 100} tone={state === "skipped" ? "bg-ui-text-3" : "bg-ui-accent"} />
                  </span>
                  <span className={`font-code text-[10px] ${STATE_TONE[state]}`}>{t(`detail.episode.${state}`)}</span>
                </div>
              </div>
              <span className="flex shrink-0 items-center gap-[6px]">{actionButtons({ index: e.file.index, path: e.file.path, ext: e.file.path.split(".").pop()!.toLowerCase(), done })}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
