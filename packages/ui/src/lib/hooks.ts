import { useCallback, useRef, useState } from "react";
import { api, ApiError, type EngineKind } from "@torrentx/api-client";
import { usePoll } from "./usePoll";

interface PollOptions {
  enabled?: boolean;
  /** Called on every failed fetch (e.g. to route 401 to the login form). */
  onError?: (e: unknown) => void;
  /** Refetches immediately and drops stale data when it changes. */
  key?: unknown;
}

const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError("internal", String(e), 0));

export function usePolled<T>(fetch: () => Promise<T>, ms: number, opts: PollOptions = {}) {
  const [state, setState] = useState<{ key: unknown; data: T | null; error: ApiError | null }>({
    key: opts.key,
    data: null,
    error: null,
  });
  const onError = useRef(opts.onError);
  onError.current = opts.onError;
  const key = opts.key;

  const reload = useCallback(async () => {
    try {
      const data = await fetch();
      setState({ key, data, error: null });
    } catch (e) {
      setState((s) => ({ key, data: s.key === key ? s.data : null, error: toApiError(e) }));
      onError.current?.(e);
    }
  }, [fetch, key]);

  usePoll(reload, ms, opts.enabled ?? true, key);
  const fresh = state.key === key;
  return { data: fresh ? state.data : null, error: fresh ? state.error : null, reload };
}

export const useTorrents = (o?: PollOptions) => usePolled(api.list, 1500, o);
export const useStats = (o?: PollOptions) => usePolled(api.stats, 2000, o);
export const useTabs = (o?: PollOptions) => usePolled(api.tabs, 5000, o);
export const useSettings = (o?: PollOptions) => usePolled(api.getSettings, 60_000, o);

/** Refetched whenever the active engine changes. */
export const useCapabilities = (engine: EngineKind | undefined, o?: PollOptions) =>
  usePolled(api.capabilities, 60_000, { ...o, enabled: !!engine && (o?.enabled ?? true), key: engine });

export function useDetails(id: string, want: { peers: boolean; pieces: boolean }, o?: PollOptions) {
  const get = useCallback(() => api.get(id), [id]);
  const peers = useCallback(() => api.peers(id), [id]);
  const pieces = useCallback(() => api.pieces(id), [id]);
  return {
    details: usePolled(get, 1000, { ...o, key: id }),
    peers: usePolled(peers, 2000, { key: id, enabled: want.peers }),
    pieces: usePolled(pieces, 3000, { key: id, enabled: want.pieces }),
  };
}
