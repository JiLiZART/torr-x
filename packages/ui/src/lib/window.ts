import type { Window } from "@tauri-apps/api/window";

/** True inside the Tauri desktop window (detection only, no IPC). */
export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// The Tauri module is imported lazily so plain browsers never load it.
function call(fn: (w: Window) => Promise<void>) {
  if (!isTauri()) return;
  import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => fn(getCurrentWindow()))
    .catch((e) => console.warn("window control failed", e));
}

export const closeWindow = () => call((w) => w.hide());
export const minimizeWindow = () => call((w) => w.minimize());
export const toggleMaximizeWindow = () => call((w) => w.toggleMaximize());
