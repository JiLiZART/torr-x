import { useEffect, useRef } from "react";
import type { Preferences, Torrent } from "@torrentx/api-client";
import type { T } from "./i18n";
import { isTauri } from "./window";

const canNotify = () => typeof Notification !== "undefined" && !isTauri();

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.1;
    osc.connect(gain).connect(ctx.destination);
    osc.onended = () => void ctx.close();
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // Audio unavailable (autoplay policy, no device): notification alone is enough.
  }
}

/** Browser notifications for completed/added torrents; the desktop app notifies natively instead. */
export function useBrowserNotifications(
  torrents: Torrent[] | null,
  n: Preferences["notifications"],
  t: T,
) {
  const prev = useRef<Map<string, number> | null>(null);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    if (n.enabled && canNotify() && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  }, [n.enabled]);

  useEffect(() => {
    if (!torrents) return;
    const before = prev.current;
    prev.current = new Map(torrents.map((x) => [x.id, x.progress]));
    if (!before || !n.enabled || !canNotify()) return;

    const show = (key: string, body: string) => {
      if (seen.current.has(key)) return false;
      seen.current.add(key);
      if (Notification.permission === "granted") new Notification("TorrentX", { body, tag: key });
      return true;
    };
    for (const x of torrents) {
      const old = before.get(x.id);
      if (old === undefined) {
        if (n.onAdd) show(`add:${x.id}`, t("notify.added", { name: x.name }));
      } else if (old < 1 && x.progress >= 1 && n.onComplete) {
        if (show(`done:${x.id}`, t("notify.completed", { name: x.name })) && n.sound) beep();
      }
    }
  }, [torrents, n, t]);
}
