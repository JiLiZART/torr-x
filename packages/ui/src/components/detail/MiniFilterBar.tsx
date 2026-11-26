import { useState, type FormEvent, type ReactNode } from "react";
import { Funnel, Plus } from "lucide-react";
import { chips, complete, parse, type Scope } from "@torrentx/query";
import { useUi } from "../../lib/context";
import { addChips, negateChip, predicateCount, removeChip } from "../../lib/lens";
import { Chip } from "../Chip";

interface MiniFilterBarProps {
  scope: Scope;
  /** The section lens: query text, never saved. */
  query: string;
  onQuery: (query: string) => void;
  placeholder: string;
  /** `48 of 112 peers · lens scoped to this section`. */
  count: ReactNode;
  /** Live values for completion (countries, clients, extensions). */
  values?: Partial<Record<string, string[]>>;
  /** Right-hand extras: the Files view switcher, Add tracker, … */
  children?: ReactNode;
}

const field = "rounded-[8px] border border-ui-border bg-ui-surface-2 font-code text-[11px] text-ui-text placeholder-ui-text-3 focus:border-ui-accent-line focus:outline-none";

/** The list's filter bar in miniature: same parser, chips and sort chip, scoped to one section. */
export function MiniFilterBar({ scope, query, onQuery, placeholder, count, values = {}, children }: MiniFilterBarProps) {
  const { t, filterBar } = useUi();
  // Hidden with the top bar's toggle, but never while it holds a filter; the view buttons stay.
  const open = filterBar || query.trim() !== "";
  const [draft, setDraft] = useState("");
  const list = chips(parse(query, scope).ast ?? { type: "and", items: [] });
  const n = predicateCount(query, scope);
  const error = draft.trim() ? parse(draft, scope).error : null;
  const completion = complete(draft, draft.length, values, scope);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || error) return;
    onQuery(addChips(query, draft, scope));
    setDraft("");
  };

  if (!open && !children) return null;
  if (!open) return <div className="flex shrink-0 items-center justify-end gap-[8px] border-b border-ui-border bg-ui-chrome-2 px-[14px] py-[6px]">{children}</div>;
  return (
    <div className="flex shrink-0 flex-col gap-[4px] border-b border-ui-border bg-ui-chrome-2 px-[14px] py-[10px]">
      <div className="flex flex-wrap items-center gap-[8px]">
        <form onSubmit={submit} className="contents">
          <input
            className={`${field} w-[210px] px-[9px] py-[6px] ${error ? "!border-ui-red text-ui-red" : ""}`}
            value={draft}
            list={`tx-mini-${placeholder}`}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && draft === "" && list.length > 0) onQuery(removeChip(query, list.length - 1, scope));
            }}
            placeholder={placeholder}
            aria-label={placeholder}
            aria-invalid={!!error}
            title={error ? `${error.message}${error.suggestion ? ` — ${t("filter.didYouMean", { suggestion: error.suggestion })}` : ""}` : t("detail.filterHint")}
          />
          <datalist id={`tx-mini-${placeholder}`}>
            {completion.options.map((option) => (
              <option key={option} value={draft.slice(0, completion.from) + option} />
            ))}
          </datalist>
        </form>
        <span className={`flex items-center gap-[5px] rounded-[8px] border px-[8px] py-[6px] font-code text-[10px] font-medium ${error ? "border-ui-red bg-ui-red-soft text-ui-red" : n > 0 ? "border-ui-accent-line bg-ui-accent-soft text-ui-accent" : "border-ui-border text-ui-text-3"}`}>
          <Funnel size={12} /> {error ? "!" : n}
        </span>
        {list.map((chip, i) => (
          <Chip key={`${i}:${chip.text}`} chip={chip} onRemove={() => onQuery(removeChip(query, i, scope))} onNegate={() => onQuery(negateChip(query, i, scope))} />
        ))}
        {list.length === 0 && (
          <span className="flex items-center gap-[4px] rounded-[8px] border border-dashed border-ui-border-strong px-[8px] py-[5px] font-code text-[11px] text-ui-text-3">
            <Plus size={11} /> {t("filter.add")}
          </span>
        )}
        <span className="flex-1" />
        {children}
      </div>
      {error ? (
        <p className="font-code text-[10px] text-ui-red">
          {error.message}
          {error.suggestion && ` — ${t("filter.didYouMean", { suggestion: error.suggestion })}`}
        </p>
      ) : (
        <p className="font-code text-[10px] text-ui-text-3">{count}</p>
      )}
    </div>
  );
}
