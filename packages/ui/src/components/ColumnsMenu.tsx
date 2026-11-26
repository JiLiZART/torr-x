import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ChevronDown, ChevronUp, GripVertical, RotateCcw } from "lucide-react";
import { useUi } from "../lib/context";
import { COLUMN_ORDER, dropIndex, moveColumn, type Column, type ColumnWidths } from "../lib/columns";

interface ColumnsMenuProps {
  order: Column[];
  onOrder: (order: Column[]) => void;
  widths: ColumnWidths;
  onWidths: (widths: ColumnWidths) => void;
  onClose: () => void;
}

const arrow = "rounded-[5px] p-[3px] text-ui-text-3 hover:bg-ui-surface-3 hover:text-ui-text disabled:opacity-30";

/** Drag columns (or use the arrows) to set the list's left-to-right order. */
export function ColumnsMenu({ order, onOrder, widths, onWidths, onClose }: ColumnsMenuProps) {
  const { t } = useUi();
  // Pointer events, not HTML5 drag and drop: the desktop window keeps native drops for .torrent files,
  // which swallows HTML5 drags in the webview.
  const list = useRef<HTMLUListElement>(null);
  const [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  const indexAt = (y: number) => {
    const items = [...(list.current?.children ?? [])];
    const i = items.findIndex((el) => y < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2);
    return i === -1 ? items.length : i;
  };
  const startDrag = (e: ReactPointerEvent<HTMLLIElement>, from: number) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const item = e.currentTarget;
    item.setPointerCapture(e.pointerId);
    let to = from;
    setDrag({ from, to });
    const move = (ev: PointerEvent) => {
      to = indexAt(ev.clientY);
      setDrag({ from, to });
    };
    const up = () => {
      item.removeEventListener("pointermove", move);
      item.removeEventListener("pointerup", up);
      item.removeEventListener("pointercancel", cancel);
      setDrag(null);
      const target = dropIndex(from, to);
      if (target !== from) onOrder(moveColumn(order, from, target));
    };
    const cancel = () => {
      to = from;
      up();
    };
    item.addEventListener("pointermove", move);
    item.addEventListener("pointerup", up);
    item.addEventListener("pointercancel", cancel);
  };

  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default" aria-label={t("common.close")} onClick={onClose} />
      <div
        role="dialog"
        aria-label={t("columns.title")}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="absolute right-[8px] top-full z-50 mt-[4px] w-[230px] overflow-hidden rounded-[10px] border border-ui-border-strong bg-ui-surface font-ui text-[12px] tracking-normal shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-ui-border px-[10px] py-[8px]">
          <span className="font-code text-[9px] tracking-[1.2px] text-ui-text-3">{t("columns.title")}</span>
          <button className="flex items-center gap-[4px] text-[11px] text-ui-text-3 hover:text-ui-text" onClick={() => {
              onOrder(COLUMN_ORDER);
              onWidths({});
            }}
            disabled={order.join() === COLUMN_ORDER.join() && Object.keys(widths).length === 0}
          >
            <RotateCcw size={11} /> {t("columns.reset")}
          </button>
        </div>
        <ul ref={list} className="py-[4px]">
          {order.map((column, i) => (
            <li
              key={column}
              onPointerDown={(e) => startDrag(e, i)}
              className={`flex cursor-grab touch-none select-none items-center gap-[8px] border-y-2 border-transparent px-[10px] py-[4px] text-ui-text-2 hover:bg-ui-surface-2 ${drag ? "cursor-grabbing" : ""} ${drag?.from === i ? "bg-ui-surface-2 opacity-50" : ""} ${drag && drag.to === i && drag.from !== i && drag.from !== i - 1 ? "!border-t-ui-accent" : ""} ${drag && i === order.length - 1 && drag.to === order.length && drag.from !== i ? "!border-b-ui-accent" : ""}`}
            >
              <GripVertical size={12} className="shrink-0 text-ui-text-3" />
              <span className="flex-1">{t(`list.col.${column}`)}</span>
              <button className={arrow} disabled={i === 0} aria-label={t("columns.left", { column: t(`list.col.${column}`) })} onClick={() => onOrder(moveColumn(order, i, i - 1))}>
                <ChevronUp size={12} />
              </button>
              <button className={arrow} disabled={i === order.length - 1} aria-label={t("columns.right", { column: t(`list.col.${column}`) })} onClick={() => onOrder(moveColumn(order, i, i + 1))}>
                <ChevronDown size={12} />
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-ui-border px-[10px] py-[7px] text-[10px] leading-[14px] text-ui-text-3">{t("columns.hint")}</p>
      </div>
    </>
  );
}
