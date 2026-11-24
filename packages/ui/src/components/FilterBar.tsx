import { useState, type FormEvent } from "react";
import { ChevronsDownUp, ChevronsUpDown, Funnel, Plus, RotateCcw, Save, Search } from "lucide-react";
import { chips, complete, parse, type Field } from "@torrentx/query";
import { useUi } from "../lib/context";
import { addChips, moveChip, negateChip, predicateCount, removeChip, type Lens } from "../lib/lens";
import { Chip } from "./Chip";
import { FilterBuilder } from "./FilterBuilder";
import { primaryButtonClass, softButtonClass } from "./Modal";

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
  values: Partial<Record<Field, string[]>>;
  save: SaveDraft | null;
  onSaveOpen: () => void;
  onSaveConfirm: (name: string) => void;
  onSaveCancel: () => void;
  onGoTo: (tabId: string) => void;
}

const input =
  "bg-tx-surface-900 border border-tx-accent-900/50 rounded-md py-1 px-2 text-xs text-tx-accent-400 placeholder-tx-accent-700 focus:outline-none focus:ring-1 focus:ring-tx-accent-700";

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
    <form
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-tx-accent-900/50 bg-tx-surface-900/60 px-2 py-1.5 text-xs"
    >
      {save.duplicate ? (
        <span className="flex-1 text-tx-accent-400">{t("save.duplicate", { tab: save.duplicate.label })}</span>
      ) : (
        <>
          <input className={`${input} w-56`} value={name} onChange={(e) => setName(e.target.value)} aria-label={t("save.name")} autoFocus />
          <code className="flex-1 break-all text-tx-accent-600">{save.query}</code>
        </>
      )}
      <button type="button" className={softButtonClass} onClick={onCancel}>
        {t("common.cancel")}
      </button>
      <button type="submit" className={primaryButtonClass} autoFocus={!!save.duplicate}>
        {save.duplicate ? t("save.goTo") : t("save.confirm")}
      </button>
    </form>
  );
}

/** The lens editor: fuzzy name input, funnel + builder, the always-visible chip row, save as tab. */
export function FilterBar({ lens, onLens, onFuzzy, snapshot, onRestore, values, save, onSaveOpen, onSaveConfirm, onSaveCancel, onGoTo }: FilterBarProps) {
  const { t } = useUi();
  const [collapsed, setCollapsed] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  const list = chips(parse(lens.query).ast ?? { type: "and", items: [] });
  const count = predicateCount(lens.query);
  const draftError = draft ? parse(draft).error : null;
  const setQuery = (query: string) => onLens({ ...lens, query });

  const completion = draft === null ? null : complete(draft, draft.length, values);
  const submitDraft = (e: FormEvent) => {
    e.preventDefault();
    if (!draft?.trim() || draftError) return;
    setQuery(addChips(lens.query, draft));
    setDraft("");
  };

  return (
    <div className="relative border-b border-tx-accent-900/30 bg-tx-surface-950 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        {!collapsed && (
          <>
            <div className="relative">
              <Search size={12} className="pointer-events-none absolute left-2 top-1.5 text-tx-accent-700" />
              <input
                className={`${input} w-52 pl-7`}
                value={lens.fuzzy}
                onChange={(e) => onFuzzy(e.target.value)}
                placeholder={t("filter.fuzzy")}
                aria-label={t("filter.fuzzy")}
              />
            </div>
            <button
              type="button"
              onClick={() => setBuilderOpen(!builderOpen)}
              aria-expanded={builderOpen}
              title={draftError ? draftError.message : t("filter.funnel", { n: count })}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${draftError ? "bg-red-900/40 text-red-300" : builderOpen || count > 0 ? "bg-tx-accent-900/30 text-tx-accent-400" : "text-tx-accent-600 hover:bg-tx-surface-900"}`}
            >
              <Funnel size={12} />
              <span>{draftError ? "!" : count}</span>
            </button>
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
          <button type="button" onClick={onRestore} className="flex items-center gap-1 rounded-full border border-tx-accent-900/50 px-2 py-1 text-xs text-tx-accent-500 hover:bg-tx-surface-900">
            <RotateCcw size={11} /> {t("filter.restore")}
          </button>
        )}
        {!collapsed &&
          (draft === null ? (
            <button type="button" onClick={() => setDraft("")} className="flex items-center gap-1 rounded-md border border-dashed border-tx-accent-900/60 px-2 py-1 text-xs text-tx-accent-600 hover:text-tx-accent-400">
              <Plus size={11} /> {t("filter.add")}
            </button>
          ) : (
            <form onSubmit={submitDraft}>
              <input
                className={`${input} w-48 ${draftError ? "border-red-700 text-red-300" : ""}`}
                value={draft}
                list="tx-filter-complete"
                autoFocus
                placeholder="field:value"
                aria-label={t("filter.add")}
                aria-invalid={!!draftError}
                title={draftError ? `${draftError.message}${draftError.suggestion ? ` — ${t("filter.didYouMean", { suggestion: draftError.suggestion })}` : ""}` : undefined}
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
        <div className="ml-auto flex items-center gap-1">
          {!collapsed && (
            <button type="button" onClick={onSaveOpen} disabled={list.length === 0 && !lens.fuzzy.trim()} className="flex items-center gap-1 rounded-md bg-tx-surface-900 px-2 py-1 text-xs text-tx-accent-500 hover:bg-tx-surface-800 disabled:opacity-40">
              <Save size={12} /> {t("filter.saveAsTab")}
            </button>
          )}
          <button type="button" onClick={() => setCollapsed(!collapsed)} title={collapsed ? t("filter.expand") : t("filter.collapse")} className="rounded-md p-1 text-tx-accent-600 hover:bg-tx-surface-900">
            {collapsed ? <ChevronsUpDown size={13} /> : <ChevronsDownUp size={13} />}
          </button>
        </div>
      </div>
      {draftError && !collapsed && (
        <p className="mt-1 text-xs text-red-400">
          {draftError.message}
          {draftError.suggestion && ` — ${t("filter.didYouMean", { suggestion: draftError.suggestion })}`}
        </p>
      )}
      {builderOpen && !collapsed && (
        <FilterBuilder
          query={lens.query}
          values={values}
          onClose={() => setBuilderOpen(false)}
          onApply={(query) => {
            setQuery(query);
            setBuilderOpen(false);
          }}
          onSaveAsTab={(query) => {
            setQuery(query);
            setBuilderOpen(false);
            onSaveOpen();
          }}
        />
      )}
      {save && <SaveAsTab key={save.query} save={save} onConfirm={onSaveConfirm} onCancel={onSaveCancel} onGoTo={onGoTo} />}
    </div>
  );
}
