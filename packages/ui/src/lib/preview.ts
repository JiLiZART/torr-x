import { useEffect, useState } from "react";
import { api, ApiError, type Preview } from "@torrentx/api-client";
import { METADATA_TIMEOUT_MS, type AddSource } from "./addFlow";

export interface PreviewState {
  preview: Preview | null;
  error: ApiError | null;
  loading: boolean;
  /** Milliseconds the request took, or has taken so far. */
  elapsed: number;
  /** Still loading after METADATA_TIMEOUT_MS. */
  timedOut: boolean;
}

/** Fetches the preview once per source; `enabled` false when the engine has no preview. */
export function usePreview(source: AddSource | null, enabled: boolean): PreviewState {
  const [state, setState] = useState<PreviewState>({ preview: null, error: null, loading: false, elapsed: 0, timedOut: false });
  useEffect(() => {
    if (!source || !enabled) return;
    let live = true;
    const started = Date.now();
    setState({ preview: null, error: null, loading: true, elapsed: 0, timedOut: false });
    const tick = setInterval(() => {
      const elapsed = Date.now() - started;
      setState((s) => (s.loading ? { ...s, elapsed, timedOut: elapsed >= METADATA_TIMEOUT_MS } : s));
    }, 250);
    const request = source.kind === "file" ? api.previewFile(source.file) : api.previewUri(source.uri);
    request
      .then((preview) => live && setState({ preview, error: null, loading: false, elapsed: Date.now() - started, timedOut: false }))
      .catch((e) => {
        const error = e instanceof ApiError ? e : new ApiError("internal", String(e), 0);
        if (live) setState({ preview: null, error, loading: false, elapsed: Date.now() - started, timedOut: false });
      })
      .finally(() => clearInterval(tick));
    return () => {
      live = false;
      clearInterval(tick);
    };
  }, [source, enabled]);
  return state;
}

