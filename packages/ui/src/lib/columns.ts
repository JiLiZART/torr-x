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
