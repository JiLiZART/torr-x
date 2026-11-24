import { useState, type FormEvent } from "react";
import { ChevronsDownUp, ChevronsUpDown, Funnel, Plus, RotateCcw, Save, Search } from "lucide-react";
import type { Torrent } from "@torrentx/api-client";
import { chips, complete, parse, type Field } from "@torrentx/query";
import { useUi } from "../lib/context";
import { addChips, moveChip, negateChip, predicateCount, removeChip, type Lens } from "../lib/lens";
import { Chip } from "./Chip";
import { FilterBuilder } from "./FilterBuilder";

export interface SaveDraft {
  /** Tab query AND lens, canonical. */
  query: string;
  /** An existing tab that already holds this query. */
  duplicate: { id: string; label: string } | null;
}

interface FilterBarProps {
  lens: Lens;
  /** A chip-level change (undoable). */
  onLens: (lens: Lens) => void;
  /** Typing in the fuzzy input. */
  onFuzzy: (text: string) => void;
  /** The lens this tab had before the user switched away. */
  snapshot: Lens | null;
  onRestore: () => void;
  tabName: string;
  all: Torrent[];
  values: Partial<Record<Field, string[]>>;
  builderOpen: boolean;
  onBuilder: (open: boolean) => void;
  save: SaveDraft | null;
  onSaveOpen: () => void;
  onSaveConfirm: (name: string) => void;
  onSaveCancel: () => void;
  onGoTo: (tabId: string) => void;
}

const field = "rounded-[8px] border border-ui-border bg-ui-surface-2 font-code text-[11px] text-ui-text placeholder-ui-text-3 focus:border-ui-accent-line focus:outline-none";
const ghost = "flex items-center gap-[6px] rounded-[8px] border border-ui-border-strong bg-ui-surface-2 px-[10px] py-[6px] text-[12px] font-medium text-ui-text-2 hover:text-ui-text disabled:opacity-40";
const accent = "flex items-center gap-[6px] rounded-[8px] bg-ui-accent px-[12px] py-[6px] text-[12px] font-semibold text-ui-bg hover:opacity-90";

function SaveAsTab({ save, onConfirm, onCancel, onGoTo }: { save: SaveDraft; onConfirm: (name: string) => void; onCancel: () => void; onGoTo: (id: string) => void }) {
  const { t } = useUi();
  const [name, setName] = useState(save.query);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.duplicate) onGoTo(save.duplicate.id);
    // A name left equal to the query stays "named by its query" (ad-hoc).
    else onConfirm(name.trim() === save.query ? "" : name.trim());
  };
  return (
    <form onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onCancel()} className="flex flex-wrap items-center gap-[8px] border-b border-ui-border bg-ui-accent-soft px-[14px] py-[8px]">
      <Save size={13} className="text-ui-accent" />
      {save.duplicate ? (
        <span className="flex-1 text-[12px] text-ui-text">{t("save.duplicate", { tab: save.duplicate.label })}</span>
      ) : (
        <>
          <input className={`${field} w-[230px] px-[9px] py-[6px] font-ui text-[12px]`} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("save.name")} autoFocus />
          <code className="min-w-0 flex-1 truncate font-code text-[11px] text-ui-accent" title={save.query}>
            {save.query}
          </code>
        </>
      )}
      <button type="button" className={ghost} onClick={onCancel}>
        {t("common.cancel")}
      </button>
      <button type="submit" className={accent} autoFocus={!!save.duplicate}>
        {save.duplicate ? t("save.goTo") : t("save.confirm")}
      </button>
    </form>
  );
}

/** The lens editor: fuzzy name input, funnel + builder, the always-visible chip row, save as tab. */
export function FilterBar(props: FilterBarProps) {
  const { lens, onLens, onFuzzy, snapshot, onRestore, tabName, all, values, builderOpen, onBuilder, save, onSaveOpen, onSaveConfirm, onSaveCancel, onGoTo } = props;
  const { t } = useUi();
  const [collapsed, setCollapsed] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const list = chips(parse(lens.query).ast ?? { type: "and", items: [] });
  const count = predicateCount(lens.query);
  const draftError = draft ? parse(draft).error : null;
  const setQuery = (query: string) => onLens({ ...lens, query });
  const errorText = draftError && `${draftError.message}${draftError.suggestion ? ` — ${t("filter.didYouMean", { suggestion: draftError.suggestion })}` : ""}`;

  const completion = draft === null ? null : complete(draft, draft.length, values);
  const submitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!draft?.trim() || draftError) return;
    setQuery(addChips(lens.query, draft));
    setDraft("");
  };
  const funnelStyle = draftError
    ? "border-ui-red bg-ui-red-soft text-ui-red"
    : builderOpen || count > 0
      ? "border-ui-accent-line bg-ui-accent-soft text-ui-accent"
      : "border-ui-border bg-ui-surface-2 text-ui-text-3 hover:text-ui-text-2";

  return (
    <>
      <div className="relative z-20 shrink-0 border-b border-ui-border bg-ui-chrome-2">
        <div className="flex min-h-[48px] flex-wrap items-center gap-[8px] px-[14px] py-[8px]">
          {!collapsed && (
            <>
              <label className={`${field} flex w-[230px] items-center gap-[7px] px-[9px] py-[6px] focus-within:border-ui-accent-line`}>
                <Search size={13} className="shrink-0 text-ui-text-3" />
                <input className="min-w-0 flex-1 bg-transparent caret-ui-accent placeholder-ui-text-3 focus:outline-none" value={lens.fuzzy} onChange={(e) => onFuzzy(e.target.value)} placeholder={t("filter.fuzzy")} aria-label={t("filter.fuzzy")} />
              </label>
              <button
                type="button"
                onClick={() => onBuilder(!builderOpen)}
                aria-expanded={builderOpen}
                title={errorText ?? t("filter.funnel", { n: count })}
                className={`flex items-center gap-[5px] rounded-[8px] border px-[8px] py-[6px] font-code text-[10px] font-medium ${funnelStyle}`}
              >
                <Funnel size={13} />
                <span>{draftError ? "!" : count}</span>
              </button>
              <span className="h-[18px] w-px bg-ui-border" />
            </>
          )}
          {list.map((chip, i) => (
            <Chip
              key={`${i}:${chip.text}`}
              chip={chip}
              status={dragging === i ? "dragging" : "active"}
              onRemove={() => setQuery(removeChip(lens.query, i))}
              onNegate={() => setQuery(negateChip(lens.query, i))}
              onDragStart={() => setDragging(i)}
              onDragEnd={() => setDragging(null)}
              onDrop={() => {
                if (dragging !== null && dragging !== i) setQuery(moveChip(lens.query, dragging, i));
                setDragging(null);
              }}
            />
          ))}
          {snapshot && (
            <button type="button" onClick={onRestore} className="flex items-center gap-[5px] rounded-full border border-ui-accent-line px-[9px] py-[4px] font-code text-[10px] text-ui-accent hover:bg-ui-accent-soft">
              <RotateCcw size={11} /> {t("filter.restore")}
            </button>
          )}
          {!collapsed &&
            (draft === null ? (
              <button type="button" onClick={() => setDraft("")} className="flex items-center gap-[4px] rounded-[8px] border border-dashed border-ui-border-strong px-[8px] py-[5px] font-code text-[11px] text-ui-text-3 hover:text-ui-text-2">
                <Plus size={11} /> {t("filter.add")}
              </button>
            ) : (
              <form onSubmit={submitDraft}>
                <input
                  className={`${field} w-[190px] px-[8px] py-[5px] ${draftError ? "!border-ui-red text-ui-red" : ""}`}
                  value={draft}
                  list="tx-filter-complete"
                  autoFocus
                  placeholder="field:value"
                  aria-label={t("filter.add")}
                  aria-invalid={!!draftError}
                  title={errorText ?? undefined}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => !draft && setDraft(null)}
                  onKeyDown={(e) => e.key === "Escape" && setDraft(null)}
                />
                <datalist id="tx-filter-complete">
                  {completion?.options.map((option) => (
                    <option key={option} value={draft.slice(0, completion.from) + option} />
                  ))}
                </datalist>
              </form>
            ))}
          <span className="flex-1" />
          {!collapsed && (
            <button type="button" onClick={onSaveOpen} disabled={list.length === 0 && !lens.fuzzy.trim()} className={ghost}>
              <Save size={13} /> {t("filter.saveAsTab")}
            </button>
          )}
          <button type="button" onClick={() => setCollapsed(!collapsed)} title={collapsed ? t("filter.expand") : t("filter.collapse")} className="rounded-[7px] p-[6px] text-ui-text-3 hover:bg-ui-surface-2 hover:text-ui-text">
            {collapsed ? <ChevronsUpDown size={14} /> : <ChevronsDownUp size={14} />}
          </button>
        </div>
        {draftError && !collapsed && <p className="px-[14px] pb-[8px] font-code text-[10px] text-ui-red">{errorText}</p>}
        {builderOpen && !collapsed && (
          <FilterBuilder
            query={lens.query}
            tabName={tabName}
            all={all}
            values={values}
            onClose={() => onBuilder(false)}
            onApply={(query) => {
              setQuery(query);
              onBuilder(false);
            }}
            onSaveAsTab={(query) => {
              setQuery(query);
              onBuilder(false);
              onSaveOpen();
            }}
          />
        )}
      </div>
      {save && <SaveAsTab key={save.query} save={save} onConfirm={onSaveConfirm} onCancel={onSaveCancel} onGoTo={onGoTo} />}
    </>
  );
}
