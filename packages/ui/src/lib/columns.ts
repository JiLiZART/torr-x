import type { Field } from "@torrentx/query";

export type Column = "name" | "size" | "progress" | "down" | "up" | "peers" | "ratio" | "state" | "tags" | "tracker";

/** The query field a column header sorts by: headers only edit the `sort:` chip. */
export const SORT_FIELD: Record<Column, Field> = {
  name: "name",
  size: "size",
  progress: "progress",
  down: "down",
  up: "up",
  peers: "peers",
  ratio: "ratio",
  state: "state",
  tags: "tag",
  tracker: "tracker",
};

// Shared by the list header and the rows so both always show the same, aligned columns (widths from
// the `Row / Torrent` canvas component). Fixed columns never shrink or wrap; lower-priority ones hide
// on narrow windows.
const FIXED = "shrink-0 whitespace-nowrap";
export const COLUMNS: Record<Column, string> = {
  name: "flex-1 min-w-0 text-left",
  size: `hidden md:block w-[70px] text-right ${FIXED}`,
  progress: `w-[120px] ${FIXED}`,
  down: `w-[88px] text-right ${FIXED}`,
  up: `w-[88px] text-right ${FIXED}`,
  peers: `hidden lg:block w-[46px] text-right ${FIXED}`,
  ratio: `hidden lg:block w-[50px] text-right ${FIXED}`,
  state: `w-[86px] text-left ${FIXED}`,
  tags: `hidden xl:block w-[110px] text-left ${FIXED}`,
  tracker: `hidden xl:block w-[92px] text-right ${FIXED}`,
};

/** The default left-to-right order. */
export const COLUMN_ORDER = Object.keys(COLUMNS) as Column[];

/** A saved order, repaired: unknown names dropped, duplicates removed, missing columns appended. */
export function columnOrder(saved: unknown): Column[] {
  const known = Array.isArray(saved) ? saved.filter((c): c is Column => COLUMN_ORDER.includes(c as Column)) : [];
  const unique = [...new Set(known)];
  return [...unique, ...COLUMN_ORDER.filter((c) => !unique.includes(c))];
}

/** `order` with the column at `from` moved to index `to`. */
export function moveColumn(order: Column[], from: number, to: number): Column[] {
  const next = [...order];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return order;
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

/** Where a column dragged from `from` lands when dropped in gap `gap` (0 = before the first, n = after the last). */
export const dropIndex = (from: number, gap: number) => (gap > from ? gap - 1 : gap);

/** Widths the user dragged, in px; a column without one keeps its default. `name` always fills the rest. */
export type ColumnWidths = Partial<Record<Column, number>>;

export const MIN_COLUMN = 44;
export const MAX_COLUMN = 600;
export const clampWidth = (px: number) => Math.round(Math.max(MIN_COLUMN, Math.min(MAX_COLUMN, px)));

/** Saved widths, repaired: only known fixed columns with numeric widths, clamped. */
export function columnWidths(saved: unknown): ColumnWidths {
  if (!saved || typeof saved !== "object") return {};
  return Object.fromEntries(
    Object.entries(saved).flatMap(([key, px]) => (key !== "name" && COLUMN_ORDER.includes(key as Column) && typeof px === "number" && Number.isFinite(px) ? [[key, clampWidth(px)]] : [])),
  );
}

/**
 * The column a header border resizes and in which direction: its left column, or, when that is the
 * filling `name`, its right neighbour (dragging right makes the neighbour narrower). Null: nothing to resize.
 */
export function resizeTarget(order: Column[], left: Column): { column: Column; sign: 1 | -1 } | null {
  if (left !== "name") return { column: left, sign: 1 };
  const right = order[order.indexOf(left) + 1];
  return right ? { column: right, sign: -1 } : null;
}
