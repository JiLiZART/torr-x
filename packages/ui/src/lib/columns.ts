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

// Shared by the list header and the rows so both always show the same, aligned columns.
// Fixed columns never shrink or wrap; lower-priority ones hide on narrow windows.
const FIXED = "shrink-0 whitespace-nowrap px-2";
export const COLUMNS: Record<Column, string> = {
  name: "flex-1 min-w-0 px-2 text-left",
  size: `hidden md:block w-20 text-right ${FIXED}`,
  progress: `w-28 text-left ${FIXED}`,
  down: `w-[6.5rem] text-right ${FIXED}`,
  up: `w-[6.5rem] text-right ${FIXED}`,
  peers: `hidden lg:block w-14 text-right ${FIXED}`,
  ratio: `hidden lg:block w-14 text-right ${FIXED}`,
  state: `w-28 text-left ${FIXED}`,
  tags: `hidden xl:block w-32 text-left ${FIXED}`,
  tracker: `hidden xl:block w-28 text-left ${FIXED}`,
};
