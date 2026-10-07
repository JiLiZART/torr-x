export type SortColumn = "name" | "size" | "progress" | "seeds" | "peers" | "download" | "upload" | "eta";

// Shared by the list header and the rows so both always show the same, aligned columns.
// Fixed columns never shrink or wrap; lower-priority ones hide on narrow windows.
const FIXED = "shrink-0 whitespace-nowrap text-right px-2";
export const COLUMNS: Record<SortColumn, string> = {
  name: "flex-1 min-w-0 px-2 text-left",
  size: `hidden md:block w-24 ${FIXED}`,
  progress: `w-24 ${FIXED}`,
  seeds: `hidden lg:block w-20 ${FIXED}`,
  peers: `hidden lg:block w-20 ${FIXED}`,
  download: `w-28 ${FIXED}`,
  upload: `w-28 ${FIXED}`,
  eta: `hidden md:block w-20 ${FIXED}`,
};
