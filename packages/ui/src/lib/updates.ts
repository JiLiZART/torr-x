import { useCallback, useEffect, useState } from "react";
import { isNewer } from "./format";

export const RELEASES_URL = "https://api.github.com/repos/JiLiZART/torr-x/releases/latest";

const DAY_MS = 86_400_000;
const CHECKED_AT = "tx.update.checkedAt";
const CACHED = "tx.update.release";
const DISMISSED = "tx.update.dismissed";

export interface Release {
  version: string;
  url: string;
}

const load = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const save = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    // Storage blocked: we just check again next time.
  }
};

async function fetchLatest(force: boolean): Promise<Release | null> {
  const cached = load(CACHED);
  if (!force && cached && Date.now() - Number(load(CHECKED_AT)) < DAY_MS) {
    return JSON.parse(cached) as Release;
  }
  if (!force && !cached && Date.now() - Number(load(CHECKED_AT)) < DAY_MS) return null;
  const res = await fetch(RELEASES_URL, { headers: { Accept: "application/vnd.github+json" } });
  // 404 = nothing published yet: not an error, check again tomorrow.
  if (res.status === 404) {
    save(CHECKED_AT, String(Date.now()));
    return null;
  }
  if (!res.ok) throw new Error(`GitHub: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as { tag_name: string; html_url: string };
  const release = { version: data.tag_name.replace(/^v/, ""), url: data.html_url };
  save(CACHED, JSON.stringify(release));
  save(CHECKED_AT, String(Date.now()));
  return release;
}

/** Daily release check (only when `enabled`); `notice` is the newer, not-dismissed release. */
export function useUpdateCheck(enabled: boolean, version: string | undefined) {
  const [latest, setLatest] = useState<Release | null>(null);
  const [dismissed, setDismissed] = useState(() => load(DISMISSED));

  useEffect(() => {
    if (!enabled || !version) return;
    fetchLatest(false).then(setLatest, (e) => console.warn("update check failed", e));
  }, [enabled, version]);

  const checkNow = useCallback(async () => {
    const r = await fetchLatest(true);
    setLatest(r);
    return r;
  }, []);

  const notice =
    latest && version && isNewer(latest.version, version) && dismissed !== latest.version ? latest : null;
  const dismiss = () => {
    if (!latest) return;
    save(DISMISSED, latest.version);
    setDismissed(latest.version);
  };
  return { notice, dismiss, checkNow };
}
