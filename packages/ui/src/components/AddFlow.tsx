import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, FileText, Folder, Funnel, Plus, TriangleAlert, X } from "lucide-react";
import { api, type AddOptions, type Priority, type Settings, type Torrent } from "@torrentx/api-client";
import { chips, evaluate, parse } from "@torrentx/query";
import { useUi } from "../lib/context";
import { bytes, formatDate } from "../lib/format";
import { removeChip } from "../lib/lens";
import { fileRow, selectShown, sourceName, type AddSource } from "../lib/addFlow";
import type { PreviewState } from "../lib/preview";
import { Chip } from "./Chip";

interface AddFlowProps {
  source: AddSource;
  state: PreviewState;
  /** The engine can preview (file list, trackers); otherwise only the add options show. */
  canPreview: boolean;
  library: Torrent[];
  settings: Settings | null;
  diskFree: number | null;
  onAdded: (id: string, name: string) => void;
  onJump: (id: string) => void;
  /** Back to the input-only palette; nothing is added. */
  onCancel: () => void;
}

type Section = "files" | "trackers" | "options" | "advanced";

const pill = "rounded-[7px] border border-ui-border px-[8px] py-[5px] text-[11px] text-ui-text-2 hover:text-ui-text disabled:opacity-40";
const field = "rounded-[8px] border border-ui-border bg-ui-surface-2 font-code text-[11px] text-ui-text placeholder-ui-text-3 focus:border-ui-accent-line focus:outline-none";

function Toggle({ on, label, onChange, hint }: { on: boolean; label: string; onChange?: (v: boolean) => void; hint?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={!onChange}
      title={hint}
      onClick={() => onChange?.(!on)}
      className={`flex items-center gap-[7px] rounded-[8px] border px-[9px] py-[6px] text-[11px] font-medium disabled:cursor-not-allowed disabled:opacity-40 ${on ? "border-ui-accent-line bg-ui-accent-soft text-ui-accent" : "border-ui-border bg-ui-surface-2 text-ui-text-2"}`}
    >
      <span className={`flex h-[13px] w-[22px] items-center rounded-full px-[2px] ${on ? "justify-end bg-ui-accent" : "bg-ui-surface-3"}`}>
        <span className={`h-[9px] w-[9px] rounded-full ${on ? "bg-ui-bg" : "bg-ui-text-3"}`} />
      </span>
      {label}
    </button>
  );
}

/** The add flow inside the palette: preview, file choice and options, then add. */
export function AddFlow({ source, state, canPreview, library, settings, diskFree, onAdded, onJump, onCancel }: AddFlowProps) {
  const { t, gate, caps, prefs } = useUi();
  const dl = settings?.downloads;
  const defaultPath = dl?.defaultSavePath || (settings?.engine.kind === "rqbit" ? settings.engine.rqbit.downloadDir : "");
  const [section, setSection] = useState<Section>("files");
  const [savePath, setSavePath] = useState(defaultPath);
  const [subfolder, setSubfolder] = useState(dl?.createSubfolder ?? true);
  const [start, setStart] = useState(dl?.startAutomatically ?? true);
  const [priority, setPriority] = useState<Priority>(dl?.defaultPriority ?? "normal");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<number> | null>(null);
  const [filePriority, setFilePriority] = useState<Record<number, Priority>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { preview, loading, timedOut } = state;
  const rows = useMemo(() => (preview ? preview.files.map(fileRow).sort((a, b) => a.path.localeCompare(b.path)) : []), [preview]);
  // Everything is wanted until the user unchecks something; hidden files keep their state.
  const chosen = selected ?? new Set(rows.map((r) => r.index));
  const parsed = parse(filter);
  const shown = parsed.ast ? rows.filter((r) => evaluate(parsed.ast!, r)) : rows;
  const chosenSize = rows.filter((r) => chosen.has(r.index)).reduce((n, r) => n + r.size, 0);
  const duplicate = preview ? library.find((row) => row.id === preview.id) : undefined;
  const name = preview?.name ?? sourceName(source);
  const engine = caps?.engine ?? "";
  const notSupported = t("caps.notSupported", { engine });
  const skipHint = gate("fileSkip");
  const filePriorityHint = gate("filePriority");
  const priorityHint = gate("torrentPriority");
  // Without a preview the add is blind: allowed only once the engine cannot preview or metadata timed out.
  const canAdd = !busy && !duplicate && (preview ? chosen.size > 0 : !canPreview || timedOut || !!state.error);

  const add = async (paused: boolean) => {
    if (!canAdd) return;
    setBusy(true);
    setError(null);
    try {
      const all = !preview || chosen.size === rows.length;
      const opts: AddOptions = {
        createSubfolder: subfolder,
        paused,
        ...(savePath.trim() && { savePath: savePath.trim() }),
        ...(!priorityHint && { priority }),
        ...(!all && !skipHint && { wantedFiles: [...chosen] }),
      };
      const id = source.kind === "file" ? await api.addFile(source.file, opts) : await api.addUri(source.uri, opts);
      if (tags.length > 0) await api.setTags(id, tags);
      if (!filePriorityHint) {
        for (const level of ["low", "high"] as Priority[]) {
          const indices = Object.entries(filePriority).filter(([, p]) => p === level).map(([i]) => Number(i));
          if (indices.length > 0) await api.setFiles(id, indices, { priority: level });
        }
      }
      onAdded(id, name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  // ⌘⏎ add & start · ⇧⏎ add paused · esc back to the plain palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void add(false);
      else if (e.key === "Enter" && e.shiftKey) void add(true);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  });

  const submitTag = (e: FormEvent) => {
    e.preventDefault();
    const tag = tagDraft?.trim().toLowerCase();
    if (tag && !tags.includes(tag)) setTags([...tags, tag]);
    setTagDraft("");
  };
  const select = (how: "all" | "none" | "invert") => setSelected(selectShown(chosen, shown.map((r) => r.index), how));
  const toggle = (index: number) => setSelected(selectShown(chosen, [index], chosen.has(index) ? "none" : "all"));

  const tab = (id: Section, label: string, count?: number) => (
    <button
      type="button"
      onClick={() => setSection(id)}
      className={`flex items-center gap-[6px] rounded-t-[8px] border-b-2 px-[10px] py-[8px] text-[12px] ${section === id ? "border-ui-accent bg-ui-surface-2 font-semibold text-ui-text" : "border-transparent text-ui-text-2 hover:text-ui-text"}`}
    >
      {label}
      {count !== undefined && <span className="font-code text-[10px] text-ui-text-3">{count}</span>}
    </button>
  );
  const meta = (text: ReactNode) => <span className="font-code text-[10px] text-ui-text-3">{text}</span>;

  // The loading line keeps the panel's height while metadata resolves.
  const body = loading && !timedOut ? (
    <div className="flex h-[260px] items-center justify-center gap-[10px] font-code text-[11px] text-ui-text-3">
      <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-ui-accent" />
      {t("addflow.resolving", { s: Math.floor(state.elapsed / 1000) })}
    </div>
  ) : !preview ? (
    <div className="flex min-h-[120px] flex-col justify-center gap-[6px] px-[18px] py-[16px] text-[12px] text-ui-text-2">
      {state.error ? (
        <span className="flex items-center gap-[8px] text-ui-red">
          <TriangleAlert size={13} /> {state.error.message}
        </span>
      ) : timedOut ? (
        <span className="flex items-center gap-[8px] text-ui-amber">
          <TriangleAlert size={13} /> {t("addflow.timeout", { name })}
        </span>
      ) : (
        <span>{t("addflow.noPreview", { engine })}</span>
      )}
    </div>
  ) : section === "files" ? (
    <>
      <div className="flex flex-wrap items-center gap-[8px] border-b border-ui-border bg-ui-chrome-2 px-[18px] py-[10px]">
        <input className={`${field} w-[200px] px-[8px] py-[5px] ${parsed.error ? "!border-ui-red" : ""}`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="ext:mkv size:>1GB" aria-label={t("addflow.filterFiles")} title={parsed.error?.message} />
        <span className={`flex items-center gap-[4px] rounded-[7px] border px-[7px] py-[5px] font-code text-[10px] ${filter.trim() ? "border-ui-accent-line bg-ui-accent-soft text-ui-accent" : "border-ui-border text-ui-text-3"}`}>
          <Funnel size={11} /> {parsed.error ? "!" : parsed.ast ? chips(parsed.ast).length : 0}
        </span>
        {parsed.ast && chips(parsed.ast).map((chip, i) => <Chip key={i} chip={chip} onRemove={() => setFilter(removeChip(filter, i))} />)}
        <span className="flex-1" />
        <button type="button" className={pill} disabled={!!skipHint} title={skipHint} onClick={() => select("all")}>
          {t("addflow.selectAll")}
        </button>
        <button type="button" className={pill} disabled={!!skipHint} title={skipHint} onClick={() => select("none")}>
          {t("addflow.selectNone")}
        </button>
        <button type="button" className={pill} disabled={!!skipHint} title={skipHint} onClick={() => select("invert")}>
          {t("addflow.invert")}
        </button>
        <span className="font-code text-[10px] text-ui-accent">{t("addflow.chosen", { n: chosen.size, m: rows.length, size: bytes(chosenSize) })}</span>
      </div>
      <div className="flex max-h-[34vh] min-h-[120px] flex-col gap-[1px] overflow-y-auto px-[10px] py-[8px]">
        {shown.length === 0 && <p className="px-[8px] py-[10px] font-code text-[11px] text-ui-text-3">{t("addflow.noFiles", { n: rows.length })}</p>}
        {shown.map((file) => (
          <label key={file.index} className="flex cursor-pointer items-center gap-[10px] rounded-[8px] px-[8px] py-[7px] hover:bg-ui-surface-2">
            <input type="checkbox" className="h-[15px] w-[15px] accent-ui-accent" checked={chosen.has(file.index)} disabled={!!skipHint} onChange={() => toggle(file.index)} />
            <span className="min-w-0 flex-1 truncate font-code text-[11px] text-ui-text" title={file.path}>
              {file.path}
            </span>
            <span className="w-[72px] shrink-0 text-right font-code text-[11px] text-ui-text-2">{bytes(file.size)}</span>
            <select
              aria-label={t("addflow.filePriority")}
              disabled={!!filePriorityHint}
              title={filePriorityHint}
              value={filePriority[file.index] ?? "normal"}
              onChange={(e) => setFilePriority({ ...filePriority, [file.index]: e.target.value as Priority })}
              className="w-[96px] shrink-0 rounded-[6px] border border-ui-border bg-ui-surface-2 px-[7px] py-[4px] font-code text-[10px] text-ui-text-2 focus:outline-none disabled:opacity-40"
            >
              {(["low", "normal", "high"] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {t(`details.priority.${p}`)}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </>
  ) : section === "trackers" ? (
    <div className="flex max-h-[34vh] min-h-[120px] flex-col gap-[4px] overflow-y-auto px-[18px] py-[12px]">
      {preview.trackers.length === 0 && meta(t("addflow.noTrackers"))}
      {preview.trackers.map((url) => (
        <span key={url} className="truncate font-code text-[11px] text-ui-text-2">
          {url}
        </span>
      ))}
    </div>
  ) : section === "options" ? (
    <div className="flex min-h-[120px] flex-col gap-[12px] px-[18px] py-[14px]">
      <label className="flex items-center gap-[10px] text-[12px] text-ui-text-2">
        {t("add.priority")}
        <select value={priority} disabled={!!priorityHint} title={priorityHint} onChange={(e) => setPriority(e.target.value as Priority)} className={`${field} px-[8px] py-[5px] disabled:opacity-40`}>
          {(["low", "normal", "high"] as Priority[]).map((p) => (
            <option key={p} value={p}>
              {t(`details.priority.${p}`)}
            </option>
          ))}
        </select>
      </label>
      {/* Drawn on the canvas, offered per torrent by no engine yet. */}
      <div className="flex flex-wrap gap-[10px]">
        <Toggle on={false} label={t("addflow.sequential")} hint={notSupported} />
        <Toggle on={false} label={t("addflow.skipCheck")} hint={notSupported} />
        <Toggle on={false} label={t("addflow.topOfQueue")} hint={notSupported} />
      </div>
    </div>
  ) : (
    <div className="grid min-h-[120px] grid-cols-[max-content_1fr] gap-x-[16px] gap-y-[6px] px-[18px] py-[14px] font-code text-[11px]">
      <span className="text-ui-text-3">{t("addflow.hash")}</span>
      <span className="break-all text-ui-text">{preview.id}</span>
      <span className="text-ui-text-3">{t("add.pieceSize")}</span>
      <span className="text-ui-text">{bytes(preview.pieceSize)}</span>
      <span className="text-ui-text-3">{t("add.pieces")}</span>
      <span className="text-ui-text">{preview.pieces}</span>
      <span className="text-ui-text-3">{t("addflow.createdBy")}</span>
      <span className="text-ui-text">{preview.createdBy ?? "—"}</span>
      <span className="text-ui-text-3">{t("addflow.comment")}</span>
      <span className="break-all text-ui-text">{preview.comment ?? "—"}</span>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <div className="flex items-center gap-[14px] border-b border-ui-border px-[18px] py-[16px]">
        <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[10px] border border-ui-border bg-ui-surface-2 text-ui-text-2">
          {preview && preview.files.length > 1 ? <Folder size={20} /> : <FileText size={20} />}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
          <span className="truncate text-[16px] font-semibold text-ui-text" title={name}>
            {name}
          </span>
          <span className="flex flex-wrap items-center gap-[10px]">
            {preview ? (
              <>
                {meta(bytes(preview.size))}
                {meta(t("addflow.files", { n: preview.files.length }))}
                {preview.createdAt && meta(t("addflow.created", { date: formatDate(preview.createdAt, "absolute", prefs.language).slice(0, 10) }))}
                {meta(`btih ${preview.id.slice(0, 6)}…${preview.id.slice(-4)}`)}
              </>
            ) : (
              meta(source.kind === "file" ? source.file.name : t("addflow.awaiting"))
            )}
          </span>
        </div>
      </div>
      {duplicate && (
        <div className="flex items-center gap-[10px] border-b border-ui-border bg-ui-amber-soft px-[18px] py-[10px] text-[12px] text-ui-amber">
          <TriangleAlert size={13} />
          <span className="flex-1">{t("addflow.duplicate", { name: duplicate.name })}</span>
          <button type="button" onClick={() => onJump(duplicate.id)} className="flex items-center gap-[5px] font-semibold underline">
            {t("addflow.jump")} <ArrowRight size={12} />
          </button>
        </div>
      )}
      {preview && (
        <div className="flex items-center gap-[4px] border-b border-ui-border px-[18px] pt-[10px]">
          {tab("files", t("add.files"), preview.files.length)}
          {tab("trackers", t("addflow.trackers"), preview.trackers.length)}
          {tab("options", t("addflow.options"))}
          {tab("advanced", t("addflow.advanced"))}
          <span className="flex-1" />
          <span className="hidden font-code text-[9px] text-ui-text-3 md:block">{t("addflow.sharedNote")}</span>
        </div>
      )}
      {body}
      <div className="flex flex-col gap-[12px] border-t border-ui-border px-[18px] py-[14px]">
        <div className="flex items-center gap-[10px]">
          <label className={`${field} flex flex-1 items-center gap-[8px] px-[10px] py-[7px] focus-within:border-ui-accent-line`}>
            <input className="min-w-0 flex-1 bg-transparent focus:outline-none" value={savePath} onChange={(e) => setSavePath(e.target.value)} placeholder={t("add.daemonDefault")} aria-label={t("add.saveLocation")} />
            {diskFree !== null && savePath === defaultPath && <span className="shrink-0 text-[10px] text-ui-text-3">{t("status.free", { size: bytes(diskFree) })}</span>}
          </label>
          <button type="button" className={pill} disabled={savePath === defaultPath} onClick={() => setSavePath(defaultPath)}>
            {t("addflow.default")}
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-[10px]">
          <Toggle on={start} label={t("addflow.start")} onChange={setStart} />
          <Toggle on={subfolder} label={t("addflow.subfolder")} onChange={setSubfolder} />
          <span className="h-[16px] w-px bg-ui-border" />
          <span className="font-code text-[10px] text-ui-text-3">{t("addflow.tags")}</span>
          {tags.map((tag) => (
            <Chip key={tag} chip={{ key: "tag", value: tag, kind: "filter", negated: false, text: `tag:${tag}` }} onRemove={() => setTags(tags.filter((x) => x !== tag))} />
          ))}
          {tagDraft === null ? (
            <button type="button" onClick={() => setTagDraft("")} className="flex items-center gap-[4px] rounded-[8px] border border-dashed border-ui-border-strong px-[8px] py-[5px] font-code text-[11px] text-ui-text-3 hover:text-ui-text-2">
              <Plus size={11} /> {t("addflow.tag")}
            </button>
          ) : (
            <form onSubmit={submitTag}>
              <input autoFocus className={`${field} w-[120px] px-[8px] py-[5px]`} value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onBlur={() => !tagDraft && setTagDraft(null)} placeholder="4k" aria-label={t("addflow.tag")} />
            </form>
          )}
        </div>
      </div>
      <div className="flex items-center gap-[12px] border-t border-ui-border bg-ui-chrome-2 px-[18px] py-[12px]">
        <span className="hidden font-code text-[10px] text-ui-text-3 md:block">{t("addflow.keys")}</span>
        {error && (
          <span className="flex min-w-0 items-center gap-[6px] truncate text-[11px] text-ui-red" title={error}>
            <X size={12} /> {error}
          </span>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onCancel} className="rounded-[9px] border border-ui-border-strong px-[14px] py-[9px] text-[12px] font-medium text-ui-text-2 hover:text-ui-text">
          {t("common.cancel")}
        </button>
        <button type="button" disabled={!canAdd} onClick={() => void add(true)} className="rounded-[9px] border border-ui-border-strong bg-ui-surface-2 px-[14px] py-[9px] text-[12px] font-medium text-ui-text disabled:opacity-40">
          {timedOut && !preview ? t("addflow.addAnywayPaused") : t("addflow.addPaused")}
        </button>
        <button type="button" disabled={!canAdd} onClick={() => void add(false)} className="flex items-center gap-[7px] rounded-[9px] bg-ui-accent px-[16px] py-[9px] text-[12px] font-semibold text-ui-bg hover:opacity-90 disabled:opacity-40">
          {timedOut && !preview ? t("addflow.addAnyway") : t("addflow.addStart")}
        </button>
      </div>
    </div>
  );
}
