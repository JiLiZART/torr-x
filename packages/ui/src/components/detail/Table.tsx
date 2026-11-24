import type { ReactNode } from "react";
import type { SortKey } from "@torrentx/query";

export interface Column {
  /** Query field the header sorts by; none for a plain header. */
  field?: string;
  label: string;
  className: string;
}

/** A section table header: clicking a column edits the section lens's `sort:` chip, nothing else. */
export function TableHeader({ columns, sort, onSort, lead }: { columns: Column[]; sort?: SortKey; onSort: (field: string) => void; lead?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-center gap-[10px] border-b border-ui-border px-[22px] py-[9px] font-code text-[9px] uppercase tracking-[1px] text-ui-text-3">
      {lead}
      {columns.map((c) =>
        c.field ? (
          <button key={c.label} onClick={() => onSort(c.field!)} className={`${c.className} uppercase hover:text-ui-text-2 ${sort?.field === c.field ? "text-ui-cyan" : ""}`}>
            {c.label}
            {sort?.field === c.field && (sort.desc ? " ↓" : " ↑")}
          </button>
        ) : (
          <span key={c.label} className={c.className}>
            {c.label}
          </span>
        ),
      )}
    </div>
  );
}

/** What a section shows instead of rows: nothing there yet, or nothing left after the lens. */
export function SectionEmpty({ children }: { children: ReactNode }) {
  return <p className="px-[22px] py-[18px] font-code text-[11px] text-ui-text-3">{children}</p>;
}

/** A thin progress bar with its percent. */
export function MiniBar({ value, tone = "bg-ui-accent", width = "flex-1" }: { value: number; tone?: string; width?: string }) {
  return (
    <span className="flex items-center gap-[7px]">
      <span className={`${width} h-[5px] overflow-hidden rounded-[3px] bg-ui-surface-3`}>
        <span className={`block h-full rounded-[3px] ${tone}`} style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </span>
      <span className="w-[38px] text-right font-code text-[10px] tabular-nums text-ui-text-3">{Math.floor(value)}%</span>
    </span>
  );
}
