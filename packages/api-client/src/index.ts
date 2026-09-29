// Typed client for the TorrentX HTTP API (`/api/v1`). Same-origin only.
// Types mirror crates/torrentx-core and crates/torrentx-server/src/api.rs.

export type Status =
  | "downloading"
  | "seeding"
  | "paused"
  | "checking"
  | "queued"
  | "error";

export interface Torrent {
  /** Lowercase hex info-hash. */
  id: string;
  name: string;
  size: number;
  /** 0..1 */
  progress: number;
  downloadRate: number;
  uploadRate: number;
  peers: number;
  seeds: number;
  status: Status;
  error: string | null;
  etaSecs: number | null;
  /** Unix seconds. */
  addedAt: number;
  savePath: string;
}

export interface FileInfo {
  path: string;
  size: number;
  progress: number;
}

export interface TorrentDetails extends Torrent {
  files: FileInfo[];
}

export type EngineKind = "rqbit" | "transmission";

export interface Health {
  app: "torrentx";
  version: string;
  engine: EngineKind;
  authRequired: boolean;
}

export interface Settings {
  server: { bind: string; port: number; allowedHosts: string[] };
  /** `password` is write-only: never returned by the server. */
  auth: { enabled: boolean; username: string; password?: string };
  engine: {
    kind: EngineKind;
    rqbit: { downloadDir: string };
    transmission: {
      url: string;
      username: string;
      /** Omit to keep the stored password, "" to clear it. */
      password?: string;
      /** Read-only. */
      hasPassword?: boolean;
    };
  };
}

export interface SaveSettingsResult {
  settings: Settings;
  restartRequired: boolean;
}

export type ErrorKind =
  | "not_found"
  | "invalid_input"
  | "duplicate"
  | "engine_unavailable"
  | "unauthorized"
  | "forbidden"
  | "internal"
  | "network";

export class ApiError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = "/api/v1";

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "same-origin" };
  if (body instanceof FormData) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, init);
  } catch (e) {
    throw new ApiError("network", `cannot reach TorrentX server: ${String(e)}`, 0);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = data?.error;
    throw new ApiError(err?.kind ?? "internal", err?.message ?? res.statusText, res.status);
  }
  return data as T;
}

const enc = encodeURIComponent;

export const api = {
  health: () => request<Health>("GET", "/health"),

  list: () => request<Torrent[]>("GET", "/torrents"),
  get: (id: string) => request<TorrentDetails>("GET", `/torrents/${enc(id)}`),
  /** Magnet link or http(s) URL to a .torrent. Resolves to the torrent id. */
  addUri: (uri: string) =>
    request<{ id: string }>("POST", "/torrents", { uri }).then((r) => r.id),
  addFile: (file: Blob) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ id: string }>("POST", "/torrents", form).then((r) => r.id);
  },
  pause: (id: string) => request<void>("POST", `/torrents/${enc(id)}/pause`),
  resume: (id: string) => request<void>("POST", `/torrents/${enc(id)}/resume`),
  remove: (id: string, deleteData = false) =>
    request<void>("DELETE", `/torrents/${enc(id)}?deleteData=${deleteData}`),

  getSettings: () => request<Settings>("GET", "/settings"),
  saveSettings: (settings: Settings) =>
    request<SaveSettingsResult>("PUT", "/settings", settings),

  login: (username: string, password: string) =>
    request<void>("POST", "/auth/login", { username, password }),
  logout: () => request<void>("POST", "/auth/logout"),
};
