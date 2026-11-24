import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { ArrowDownUp, X } from "lucide-react";
import type { Chip as QueryChip } from "@torrentx/query";
import { useUi } from "../lib/context";

interface ChipProps {
  chip: QueryChip;
  /** `default` = shown for reference, `active` = applied to the list. */
  status?: "default" | "active" | "dragging";
  onRemove?: () => void;
  /** ⌥-click. */
  onNegate?: () => void;
  onDragStart?: (e: DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: DragEvent) => void;
}

const STYLE = {
  default: "bg-tx-surface-900 border-tx-accent-900/40 text-tx-accent-500",
  active: "bg-tx-accent-900/30 border-tx-accent-800 text-tx-accent-400",
  sort: "bg-tx-surface-800 border-tx-accent-700 border-dashed text-tx-accent-300",
  dragging: "bg-tx-surface-800 border-tx-accent-600 text-tx-accent-400 opacity-50",
};

const chipSibling = (from: Element, step: "previousElementSibling" | "nextElementSibling") => {
  let el = from[step];
  while (el && !(el instanceof HTMLElement && el.dataset.chip !== undefined)) el = el[step];
  return el as HTMLElement | null;
};

/** One query predicate, rendered the same wherever a query is shown. */
export function Chip({ chip, status = "active", onRemove, onNegate, onDragStart, onDragEnd, onDrop }: ChipProps) {
  const { t } = useUi();
  const style = status === "dragging" ? STYLE.dragging : chip.kind === "sort" ? STYLE.sort : STYLE[status];
  const interactive = !!onRemove;

  const handleClick = (e: MouseEvent) => {
    if (e.altKey) onNegate?.();
  };
  // ←/→ walk the chip row, ⌫ removes and keeps the focus in the row.
  const handleKeyDown = (e: KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === "ArrowLeft") chipSibling(e.currentTarget, "previousElementSibling")?.focus();
    else if (e.key === "ArrowRight") chipSibling(e.currentTarget, "nextElementSibling")?.focus();
    else if (e.key === "Backspace" || e.key === "Delete") {
      const next = chipSibling(e.currentTarget, "previousElementSibling") ?? chipSibling(e.currentTarget, "nextElementSibling");
      onRemove?.();
      next?.focus();
    } else return;
    e.preventDefault();
  };

  return (
    <span
      data-chip
      tabIndex={interactive ? 0 : undefined}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDrop && ((e) => e.preventDefault())}
      onDrop={onDrop}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={interactive ? handleKeyDown : undefined}
      title={interactive && chip.kind === "filter" ? t("filter.chipHint") : undefined}
      className={`group/chip inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-tx-accent-500 ${style}`}
    >
      {chip.kind === "sort" && <ArrowDownUp size={11} aria-hidden />}
      {chip.key && <span className="opacity-60">{chip.negated ? `!${chip.key}:` : `${chip.key}:`}</span>}
      <span>{chip.value}</span>
      {onRemove && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("filter.remove", { chip: chip.text })}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="opacity-50 hover:opacity-100 group-hover/chip:opacity-100"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}
