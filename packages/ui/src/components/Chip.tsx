import type { DragEvent, KeyboardEvent, MouseEvent } from "react";
import { ArrowDownUp, Braces, Hash, X } from "lucide-react";
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

// Variants of the canvas `Chip` component: [container, key color].
const STYLE = {
  default: ["bg-ui-surface-2 border-ui-border text-ui-text", "text-ui-text-3"],
  active: ["bg-ui-accent-soft border-ui-accent-line text-ui-accent", "text-ui-accent"],
  sort: ["bg-ui-cyan-soft border-ui-cyan text-ui-cyan", "text-ui-cyan"],
  dragging: ["bg-ui-surface-3 border-ui-border-strong text-ui-text", "text-ui-text-2"],
};
const LEAD = { filter: Hash, sort: ArrowDownUp, group: Braces };

const chipSibling = (from: Element, step: "previousElementSibling" | "nextElementSibling") => {
  let el = from[step];
  while (el && !(el instanceof HTMLElement && el.dataset.chip !== undefined)) el = el[step];
  return el as HTMLElement | null;
};

/** One query predicate, rendered the same wherever a query is shown. */
export function Chip({ chip, status = "active", onRemove, onNegate, onDragStart, onDragEnd, onDrop }: ChipProps) {
  const { t } = useUi();
  const [box, keyColor] = status === "dragging" ? STYLE.dragging : chip.kind === "sort" ? STYLE.sort : STYLE[status];
  const Lead = LEAD[chip.kind];
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
      className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-[8px] border px-[8px] py-[5px] font-code text-[11px] leading-none focus:outline-none focus-visible:ring-1 focus-visible:ring-ui-accent ${box}`}
    >
      <Lead size={12} className={keyColor} aria-hidden />
      {chip.key && <span className={keyColor}>{chip.negated ? `!${chip.key}:` : `${chip.key}:`}</span>}
      <span className="font-medium">{chip.value}</span>
      {onRemove && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("filter.remove", { chip: chip.text })}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className={`${keyColor} hover:text-ui-text`}
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}
