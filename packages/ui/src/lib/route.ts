import { useCallback, useEffect, useRef, useState } from "react";
import { isSection, type Section } from "./detail";

export const ALL_TAB = "all";

// Hash addresses work the same in a browser and in the desktop window, need no server routes,
// and never carry a lens: `#/tab/<id>` and `#/torrent/<id>/<section>`.
export type View = { kind: "tab"; tabId: string } | { kind: "torrent"; id: string; section: Section };

function read(): View {
  const torrent = /^#\/torrent\/([0-9a-fA-F]{40})(?:\/([a-z]+))?$/.exec(window.location.hash);
  if (torrent) {
    const section = torrent[2] && isSection(torrent[2]) ? torrent[2] : "overview";
    return { kind: "torrent", id: torrent[1].toLowerCase(), section };
  }
  const id = /^#\/tab\/(.+)$/.exec(window.location.hash)?.[1];
  return { kind: "tab", tabId: id ? decodeURIComponent(id) : ALL_TAB };
}

const hashOf = (view: View) =>
  view.kind === "tab" ? `#/tab/${encodeURIComponent(view.tabId)}` : `#/torrent/${view.id}/${view.section}`;

export interface Route {
  view: View;
  /** The tab the list shows; while a torrent page is open, the tab it was opened from. */
  tabId: string;
  /** `replace` rewrites the history entry instead of adding one. */
  navigate: (tabId: string, replace?: boolean) => void;
  openTorrent: (id: string, section?: Section, replace?: boolean) => void;
}

export function useRoute(): Route {
  const [view, setView] = useState(read);
  const lastTab = useRef(view.kind === "tab" ? view.tabId : ALL_TAB);
  if (view.kind === "tab") lastTab.current = view.tabId;
  useEffect(() => {
    const sync = () => setView(read());
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const go = useCallback((next: View, replace: boolean) => {
    const hash = hashOf(next);
    if (replace) window.history.replaceState(null, "", hash);
    else if (window.location.hash !== hash) window.location.hash = hash;
    // Not waiting for `hashchange`: callers may change the tab list right after.
    setView(next);
  }, []);
  const navigate = useCallback((tabId: string, replace = false) => go({ kind: "tab", tabId }, replace), [go]);
  const openTorrent = useCallback(
    (id: string, section: Section = "overview", replace = false) => go({ kind: "torrent", id, section }, replace),
    [go],
  );
  return { view, tabId: view.kind === "tab" ? view.tabId : lastTab.current, navigate, openTorrent };
}
