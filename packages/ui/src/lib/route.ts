import { useCallback, useEffect, useRef, useState } from "react";
import { isSection, type Section } from "./detail";
import { isSettingsSection, type SettingsSection } from "./settings";

export const ALL_TAB = "all";
/** Tabs the server seeds; filter-bar edits on them stay a lens, on any other tab they rewrite the tab. */
export const BUILT_IN_TABS: readonly string[] = [ALL_TAB, "downloading", "active", "seeding", "stalled"];

// Hash addresses work the same in a browser and in the desktop window, need no server routes,
// and never carry a lens: `#/tab/<id>`, `#/torrent/<id>/<section>` and `#/settings/<section>`.
export type View =
  | { kind: "tab"; tabId: string }
  | { kind: "torrent"; id: string; section: Section }
  | { kind: "settings"; section: SettingsSection };

function read(): View {
  const torrent = /^#\/torrent\/([0-9a-fA-F]{40})(?:\/([a-z]+))?$/.exec(window.location.hash);
  if (torrent) {
    const section = torrent[2] && isSection(torrent[2]) ? torrent[2] : "overview";
    return { kind: "torrent", id: torrent[1].toLowerCase(), section };
  }
  const settings = /^#\/settings(?:\/([a-z]+))?$/.exec(window.location.hash);
  if (settings) return { kind: "settings", section: settings[1] && isSettingsSection(settings[1]) ? settings[1] : "general" };
  const id = /^#\/tab\/(.+)$/.exec(window.location.hash)?.[1];
  return { kind: "tab", tabId: id ? decodeURIComponent(id) : ALL_TAB };
}

const hashOf = (view: View) =>
  view.kind === "tab"
    ? `#/tab/${encodeURIComponent(view.tabId)}`
    : view.kind === "torrent"
      ? `#/torrent/${view.id}/${view.section}`
      : `#/settings/${view.section}`;

/**
 * Asked before leaving the settings page. Returns true to leave now; false keeps the page and calls
 * `proceed` later if the user agrees to leave.
 */
export type LeaveGuard = (proceed: () => void) => boolean;

const leaves = (from: View, next: View) => from.kind === "settings" && next.kind !== "settings";

export interface Route {
  view: View;
  /** The tab the list shows; while another page is open, the tab it was opened from. */
  tabId: string;
  /** `replace` rewrites the history entry instead of adding one. */
  navigate: (tabId: string, replace?: boolean) => void;
  openTorrent: (id: string, section?: Section, replace?: boolean) => void;
  openSettings: (section: SettingsSection, replace?: boolean) => void;
  setLeaveGuard: (guard: LeaveGuard | null) => void;
}

export function useRoute(): Route {
  const [view, setView] = useState(read);
  const current = useRef(view);
  current.current = view;
  const guard = useRef<LeaveGuard | null>(null);
  const lastTab = useRef(view.kind === "tab" ? view.tabId : ALL_TAB);
  if (view.kind === "tab") lastTab.current = view.tabId;
  const go = useCallback((next: View, replace: boolean) => {
    const move = () => {
      const hash = hashOf(next);
      if (replace) window.history.replaceState(null, "", hash);
      else if (window.location.hash !== hash) window.location.hash = hash;
      // Not waiting for `hashchange`: callers may change the tab list right after.
      current.current = next;
      setView(next);
    };
    if (leaves(current.current, next) && guard.current && !guard.current(move)) return;
    move();
  }, []);
  useEffect(() => {
    const sync = () => {
      const next = read();
      // Browser back/forward already changed the address: put it back while the user decides.
      if (leaves(current.current, next) && guard.current && !guard.current(() => go(next, false))) {
        window.history.pushState(null, "", hashOf(current.current));
        return;
      }
      current.current = next;
      setView(next);
    };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [go]);
  const navigate = useCallback((tabId: string, replace = false) => go({ kind: "tab", tabId }, replace), [go]);
  const openTorrent = useCallback(
    (id: string, section: Section = "overview", replace = false) => go({ kind: "torrent", id, section }, replace),
    [go],
  );
  const openSettings = useCallback(
    (section: SettingsSection, replace = false) => go({ kind: "settings", section }, replace),
    [go],
  );
  const setLeaveGuard = useCallback((next: LeaveGuard | null) => {
    guard.current = next;
  }, []);
  return { view, tabId: view.kind === "tab" ? view.tabId : lastTab.current, navigate, openTorrent, openSettings, setLeaveGuard };
}
