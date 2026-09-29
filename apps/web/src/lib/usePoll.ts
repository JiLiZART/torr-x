import { useEffect, useRef } from "react";

/** Calls `fn` now and every `ms` while the page is visible (and `enabled`). */
export function usePoll(fn: () => unknown, ms: number, enabled = true) {
  const latest = useRef(fn);
  latest.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const tick = () => void latest.current();
    const start = () => {
      if (timer || document.hidden) return;
      tick();
      timer = setInterval(tick, ms);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ms, enabled]);
}
