import { useCallback, useEffect, useRef, useState } from "react";
import { api, type EngineKind, type SaveSettingsResult, type Settings } from "@torrentx/api-client";
import { changeClass, getPath, settingsBody, type SettingPath } from "../../lib/settings";

export type RowStatus = { state: "saving" } | { state: "saved" } | { state: "error"; message: string };

const SAVED_FOR_MS = 2000;

export interface SettingsStore {
  /** The server's settings; null until loaded. */
  saved: Settings | null;
  /** What a control shows: a staged value, else the saved one. */
  value: <T>(path: SettingPath) => T;
  /** Saves an ordinary change at once; stages a restart or exposure change. */
  change: (path: SettingPath, value: unknown) => void;
  status: Record<SettingPath, RowStatus>;
  /** Staged until "Restart engine": path → value. */
  restart: Record<SettingPath, unknown>;
  /** Staged until Apply. */
  exposure: Record<SettingPath, unknown>;
  restartEngine: () => Promise<boolean>;
  applyExposure: () => Promise<SaveSettingsResult | null>;
  discard: () => void;
  /** Error from the last restart or apply. */
  stagedError: string | null;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Settings as rows edit them: one PUT per change, queued so changes never overwrite each other. */
export function useSettingsStore(engine: EngineKind, onSaved: (settings: Settings) => void, onError: (e: unknown) => void): SettingsStore {
  const [saved, setSaved] = useState<Settings | null>(null);
  const latest = useRef<Settings | null>(null);
  const [status, setStatus] = useState<Record<SettingPath, RowStatus>>({});
  const [restart, setRestart] = useState<Record<SettingPath, unknown>>({});
  const [exposure, setExposure] = useState<Record<SettingPath, unknown>>({});
  const [stagedError, setStagedError] = useState<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const timers = useRef(new Map<SettingPath, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    api.getSettings().then((data) => {
      latest.current = data;
      setSaved(data);
    }, onError);
  }, [onError]);
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const mark = useCallback((paths: SettingPath[], next: RowStatus | null) => {
    setStatus((current) => {
      const copy = { ...current };
      for (const p of paths) {
        if (next) copy[p] = next;
        else delete copy[p];
      }
      return copy;
    });
    if (next?.state !== "saved") return;
    for (const p of paths) {
      clearTimeout(timers.current.get(p));
      timers.current.set(p, setTimeout(() => mark([p], null), SAVED_FOR_MS));
    }
  }, []);

  /** PUTs the latest saved settings plus `changes`; resolves to the result, or throws. */
  const put = useCallback(
    (changes: Record<SettingPath, unknown>) => {
      const run = async () => {
        const res = await api.saveSettings(settingsBody(latest.current!, changes));
        latest.current = res.settings;
        setSaved(res.settings);
        onSaved(res.settings);
        return res;
      };
      const next = queue.current.then(run, run);
      queue.current = next.catch(() => undefined);
      return next;
    },
    [onSaved],
  );

  const stage = (setter: typeof setRestart, path: SettingPath, value: unknown) =>
    setter((current) => {
      const copy = { ...current };
      // Back to the saved value: nothing left to stage.
      if (latest.current && JSON.stringify(getPath(latest.current, path)) === JSON.stringify(value)) delete copy[path];
      else copy[path] = value;
      return copy;
    });

  const change = (path: SettingPath, value: unknown) => {
    const cls = changeClass(path, engine);
    if (cls === "restart") return stage(setRestart, path, value);
    if (cls === "apply") return stage(setExposure, path, value);
    mark([path], { state: "saving" });
    put({ [path]: value }).then(
      () => mark([path], { state: "saved" }),
      (e) => mark([path], { state: "error", message: message(e) }),
    );
  };

  const value = <T,>(path: SettingPath): T =>
    (path in restart ? restart[path] : path in exposure ? exposure[path] : saved ? getPath(saved, path) : undefined) as T;

  const commitStaged = async (staged: Record<SettingPath, unknown>, clear: () => void) => {
    setStagedError(null);
    const paths = Object.keys(staged);
    mark(paths, { state: "saving" });
    try {
      const res = await put(staged);
      clear();
      mark(paths, { state: "saved" });
      return res;
    } catch (e) {
      mark(paths, null);
      setStagedError(message(e));
      return null;
    }
  };

  return {
    saved,
    value,
    change,
    status,
    restart,
    exposure,
    restartEngine: async () => (await commitStaged(restart, () => setRestart({}))) !== null,
    applyExposure: () => commitStaged(exposure, () => setExposure({})),
    discard: () => {
      setRestart({});
      setExposure({});
      setStagedError(null);
    },
    stagedError,
  };
}
