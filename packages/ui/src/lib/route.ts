import { useCallback, useEffect, useState } from "react";

export const ALL_TAB = "all";

// Hash addresses work the same in a browser and in the desktop window, need no server routes,
// and never carry a lens. `#/tab/<id>` today; torrent and settings views get their own prefix later.
const read = () => {
  const id = /^#\/tab\/(.+)$/.exec(window.location.hash)?.[1];
  return id ? decodeURIComponent(id) : ALL_TAB;
};

/** The addressed tab plus a navigator; `replace` rewrites the entry instead of adding history. */
export function useRoute(): [string, (tabId: string, replace?: boolean) => void] {
  const [tabId, setTabId] = useState(read);
  useEffect(() => {
    const sync = () => setTabId(read());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const navigate = useCallback((id: string, replace = false) => {
    const hash = `#/tab/${encodeURIComponent(id)}`;
    if (replace) window.history.replaceState(null, "", hash);
    else window.location.hash = hash;
    // Not waiting for `hashchange`: callers may change the tab list right after.
    setTabId(id);
  }, []);
  return [tabId, navigate];
}
