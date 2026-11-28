import type { Window } from "@tauri-apps/api/window";

/** True inside the Tauri desktop window (detection only, no IPC). */
export const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type WindowStyle = "mac" | "windows" | "linux";

/** Window button style for a user agent; anything not macOS or Windows gets the Linux buttons. */
export function windowStyle(ua: string): WindowStyle {
  if (/Mac|iPhone|iPad/.test(ua)) return "mac";
  if (/Windows/.test(ua)) return "windows";
  return "linux";
}

export const WINDOW_STYLE: WindowStyle = windowStyle(typeof navigator === "undefined" ? "" : navigator.userAgent);

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

/** Desktop window only: flags <html> for rounded corners, squared while maximized or fullscreen. */
export function initDesktopChrome(): () => void {
  if (!isTauri()) return () => {};
  const root = document.documentElement;
  root.dataset.desktop = "";
  root.dataset.window = WINDOW_STYLE;
  let stopped = false;
  let unlisten: (() => void) | undefined;
  import("@tauri-apps/api/window")
    .then(async ({ getCurrentWindow }) => {
      const w = getCurrentWindow();
      const sync = async () => root.toggleAttribute("data-maximized", (await w.isMaximized()) || (await w.isFullscreen()));
      await sync();
      const off = await w.onResized(() => void sync());
      if (stopped) off();
      else unlisten = off;
    })
    .catch((e) => console.warn("window chrome failed", e));
  return () => {
    stopped = true;
    unlisten?.();
  };
}
