import { useEffect, useSyncExternalStore } from "react";
import type { Preferences, Theme } from "@torrentx/api-client";

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");
const subscribe = (cb: () => void) => {
  const mq = darkQuery();
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** OS preference mapped to a theme: dark → hacker, light → light. */
export function useSystemTheme(): Theme {
  return useSyncExternalStore(subscribe, () => darkQuery().matches) ? "hacker" : "light";
}

/** Applies the chosen theme and language to <html>. */
export function useApplyPrefs(prefs: Preferences) {
  const system = useSystemTheme();
  const theme = prefs.useSystemTheme ? system : prefs.theme;
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = prefs.language;
  }, [theme, prefs.language]);
}
