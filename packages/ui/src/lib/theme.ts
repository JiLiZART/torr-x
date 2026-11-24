import { useEffect, useSyncExternalStore } from "react";
import type { Preferences } from "@torrentx/api-client";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const subscribe = (cb: () => void) => {
  const mq = darkQuery();
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** The OS color scheme, re-rendering when it changes. */
export function useSystemDark(): boolean {
  return useSyncExternalStore(subscribe, () => darkQuery().matches);
}

/** Applies mode (resolving `system` live), accent and language to <html>. */
export function useApplyPrefs(prefs: Preferences) {
  const systemDark = useSystemDark();
  const { mode, accent } = prefs.appearance;
  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.dataset.accent = accent;
    root.lang = prefs.language;
  }, [resolved, accent, prefs.language]);
}
