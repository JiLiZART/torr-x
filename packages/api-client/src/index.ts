// Typed client for the TorrentX HTTP API (`/api/v1`). Same-origin only.
// Types mirror crates/torrentx-core and crates/torrentx-server/src/api.rs.

export type Status =
  | "downloading"
  | "seeding"
  | "paused"
  | "checking"
  | "queued"
  | "error";

export type Priority = "low" | "normal" | "high";

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
  downloaded: number;
  uploaded: number;
  ratio: number | null;
  wantedSize: number;
  /** Normalized (trimmed, lowercase, unique) user tags; stored by the server. */
  tags: string[];
  /** Host of the first tracker. */
  tracker: string | null;
  priority: Priority;
}

export interface FileInfo {
  index: number;
  path: string;
  size: number;
  progress: number;
  wanted: boolean;
  priority: Priority;
}

export interface Tracker {
  /** Announce URL; `[DHT]` / `[PeX]` for the pseudo-rows. */
  url: string;
  kind: "tracker" | "dht" | "pex";
  /** Announce-list tier; null for pseudo-rows. */
  tier: number | null;
  status: string | null;
  /** The engine's failure text, verbatim. */
  error: string | null;
  lastAnnounce: number | null;
  nextAnnounce: number | null;
  seeds: number | null;
  leechers: number | null;
  /** Bytes downloaded through this tracker's peers. */
  downloaded: number | null;
}

export interface WebSeed {
  url: string;
  kind: "bep19" | "bep17";
  status: string | null;
  /** Bytes per second. */
  speed: number | null;
  downloaded: number | null;
  error: string | null;
}

export interface TorrentDetails extends Torrent {
  pieceSize: number | null;
  pieces: number | null;
  availability: number | null;
  wasted: number | null;
  createdBy: string | null;
  comment: string | null;
  createdAt: number | null;
  trackers: Tracker[];
  webSeeds: WebSeed[];
  files: FileInfo[];
}

export interface Peer {
  address: string;
  client: string | null;
  country: string | null;
  progress: number | null;
  downloadRate: number;
  uploadRate: number;
  /** Engine flag letters (D, U, I, E, K, S, X, …). */
  flags: string | null;
  /** Cipher (`rc4`); null when plain or unknown. */
  encryption: string | null;
  isSeed: boolean;
}

export interface Pieces {
  count: number;
  /** Base64, MSB-first bitfield. */
  bitfield: string;
}

export interface Preview {
  id: string;
  name: string;
  size: number;
  pieceSize: number;
  pieces: number;
  createdAt: number | null;
  createdBy: string | null;
  comment: string | null;
  trackers: string[];
  files: { index: number; path: string; size: number }[];
}

export interface AddOptions {
  savePath?: string;
  createSubfolder?: boolean;
  paused?: boolean;
  priority?: Priority;
  wantedFiles?: number[];
}

/** A saved query. An empty `name` means the tab is named by its query (ad-hoc). */
export interface Tab {
  id: string;
  name: string;
  /** `@torrentx/query` text, stored verbatim even when it does not parse. */
  query: string;
  /** Position in the list. */
  order: number;
  pinned: boolean;
  group: string | null;
}

export interface TabList {
  /** Grammar the queries were written in. */
  grammarVersion: number;
  tabs: Tab[];
}

/** `group: null` ungroups; `order` moves the tab to that position. */
export type TabPatch = Partial<Pick<Tab, "name" | "query" | "order" | "pinned" | "group">>;

export interface Stats {
  downloadRate: number;
  uploadRate: number;
  downloaded: number;
  uploaded: number;
  ratio: number | null;
  torrents: number;
  active: number;
  diskFree: number | null;
  diskTotal: number | null;
  cpuPercent: number;
  memoryBytes: number;
}

export interface Feature {
  supported: boolean;
  via: "engine" | "server" | null;
  note?: string;
}

export interface Capabilities {
  engine: EngineKind;
  features: Record<string, Feature>;
}

export type EngineKind = "rqbit" | "transmission";

export interface Health {
  app: "torrentx";
  version: string;
  engine: EngineKind;
  authRequired: boolean;
}

export type Language = "en" | "fr" | "de" | "es" | "ru" | "zh";
/** `system` follows the OS preference, live. */
export type Mode = "system" | "light" | "dark";
export type Accent = "green" | "cyan" | "amber" | "violet";
export interface Appearance {
  mode: Mode;
  accent: Accent;
}
export type DateFormat = "relative" | "absolute" | "iso";
export type ProxyKind = "none" | "http" | "socks4" | "socks5";

export interface TransmissionSettings {
  host: string;
  port: number;
  path: string;
  https: boolean;
  username: string;
  /** Omit to keep the stored password, "" to clear it. */
  password?: string;
  /** Read-only. */
  hasPassword?: boolean;
}

export interface Preferences {
  startWithSystem: boolean;
  startMinimized: boolean;
  confirmExitWhileDownloading: boolean;
  checkForUpdates: boolean;
  language: Language;
  appearance: Appearance;
  showSpeedGraph: boolean;
  showPieceMap: boolean;
  dateFormat: DateFormat;
  notifications: { enabled: boolean; onComplete: boolean; onAdd: boolean; sound: boolean };
}

export interface Settings {
  server: { bind: string; port: number; allowedHosts: string[] };
  /** `password` is write-only: never returned by the server. */
  auth: { enabled: boolean; username: string; password?: string };
  engine: {
    kind: EngineKind;
    rqbit: { downloadDir: string };
    transmission: TransmissionSettings;
  };
  network: {
    maxConnectionsPerTorrent: number;
    maxUploadKBps: number;
    maxDownloadKBps: number;
    listenPort: number;
    upnp: boolean;
    proxy: {
      type: ProxyKind;
      host: string;
      port: number;
      authRequired: boolean;
      username: string;
      password?: string;
      hasPassword?: boolean;
    };
  };
  downloads: {
    defaultSavePath: string;
    createSubfolder: boolean;
    moveCompletedEnabled: boolean;
    moveCompletedPath: string;
    maxActiveDownloads: number;
    maxActiveTorrents: number;
    startAutomatically: boolean;
    defaultPriority: Priority;
    seedAutomatically: boolean;
    minRatio: number;
    minSeedingMinutes: number;
  };
  advanced: {
    diskCacheMB: number;
    osCache: boolean;
    superSeeding: boolean;
    dht: boolean;
    pex: boolean;
    lpd: boolean;
    anonymousMode: boolean;
    sequentialDownload: boolean;
    webSocketTrackers: boolean;
  };
  preferences: Preferences;
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
  | "unsupported"
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

function addForm(file: Blob, opts: AddOptions): FormData {
  const form = new FormData();
  form.append("file", file);
  form.append("options", JSON.stringify(opts));
  return form;
}

export const api = {
  health: () => request<Health>("GET", "/health"),
  stats: () => request<Stats>("GET", "/stats"),
  capabilities: () => request<Capabilities>("GET", "/capabilities"),

  list: () => request<Torrent[]>("GET", "/torrents"),
  get: (id: string) => request<TorrentDetails>("GET", `/torrents/${enc(id)}`),
  peers: (id: string) => request<Peer[]>("GET", `/torrents/${enc(id)}/peers`),
  pieces: (id: string) => request<Pieces>("GET", `/torrents/${enc(id)}/pieces`),
  /** Magnet link or http(s) URL to a .torrent. Resolves to the torrent id. */
  addUri: (uri: string, opts: AddOptions = {}) =>
    request<{ id: string }>("POST", "/torrents", { uri, ...opts }).then((r) => r.id),
  addFile: (file: Blob, opts: AddOptions = {}) =>
    request<{ id: string }>("POST", "/torrents", addForm(file, opts)).then((r) => r.id),
  previewUri: (uri: string) => request<Preview>("POST", "/torrents/preview", { uri }),
  previewFile: (file: Blob) => request<Preview>("POST", "/torrents/preview", addForm(file, {})),
  pause: (id: string) => request<void>("POST", `/torrents/${enc(id)}/pause`),
  resume: (id: string) => request<void>("POST", `/torrents/${enc(id)}/resume`),
  remove: (id: string, deleteData = false) =>
    request<void>("DELETE", `/torrents/${enc(id)}?deleteData=${deleteData}`),
  verify: (id: string) => request<void>("POST", `/torrents/${enc(id)}/verify`),
  relocate: (id: string, path: string) =>
    request<void>("POST", `/torrents/${enc(id)}/relocate`, { path, moveData: true }),
  rename: (id: string, name: string) =>
    request<void>("POST", `/torrents/${enc(id)}/rename`, { name }),
  addTracker: (id: string, url: string) =>
    request<void>("POST", `/torrents/${enc(id)}/trackers`, { url }),
  setFiles: (id: string, indices: number[], change: { wanted?: boolean; priority?: Priority }) =>
    request<void>("PUT", `/torrents/${enc(id)}/files`, { indices, ...change }),
  magnet: (id: string) =>
    request<{ uri: string }>("GET", `/torrents/${enc(id)}/magnet`).then((r) => r.uri),
  /** URL for a plain `<a download>`; same-origin cookies apply. */
  torrentFileUrl: (id: string) => `${BASE}/torrents/${enc(id)}/torrent-file`,
  reveal: (id: string) => request<void>("POST", `/torrents/${enc(id)}/reveal`),
  reannounce: (id: string) => request<void>("POST", `/torrents/${enc(id)}/reannounce`),
  addWebSeed: (id: string, url: string) => request<void>("POST", `/torrents/${enc(id)}/web-seeds`, { url }),
  /** Opens the file on the machine running TorrentX (loopback clients only). */
  openFile: (id: string, index: number) => request<void>("POST", `/torrents/${enc(id)}/files/${index}/open`),
  revealFile: (id: string, index: number) => request<void>("POST", `/torrents/${enc(id)}/files/${index}/reveal`),
  /** Replaces the torrent's tags. */
  setTags: (id: string, tags: string[]) => request<void>("PUT", `/torrents/${enc(id)}/tags`, tags),

  tabs: () => request<TabList>("GET", "/tabs"),
  createTab: (tab: Pick<Tab, "query"> & Partial<Pick<Tab, "name" | "pinned" | "group">>) =>
    request<Tab>("POST", "/tabs", tab),
  updateTab: (id: string, patch: TabPatch) => request<Tab>("PATCH", `/tabs/${enc(id)}`, patch),
  deleteTab: (id: string) => request<void>("DELETE", `/tabs/${enc(id)}`),

  getSettings: () => request<Settings>("GET", "/settings"),
  saveSettings: (settings: Settings) =>
    request<SaveSettingsResult>("PUT", "/settings", settings),
  testTransmission: (t: TransmissionSettings) => request<void>("POST", "/transmission/test", t),

  login: (username: string, password: string) =>
    request<void>("POST", "/auth/login", { username, password }),
  logout: () => request<void>("POST", "/auth/logout"),
};
