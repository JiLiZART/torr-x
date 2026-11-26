// The settings page's pure logic: sections, addresses, which changes save at once, the row registry and search.
import type { EngineKind, Settings } from "@torrentx/api-client";

export const SETTINGS_SECTIONS = [
  "general",
  "engine",
  "network",
  "bandwidth",
  "queue",
  "folders",
  "tabs",
  "security",
  "notifications",
  "appearance",
  "about",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const isSettingsSection = (s: string): s is SettingsSection => (SETTINGS_SECTIONS as readonly string[]).includes(s);

/** The shareable form of a section's address. */
export const deepLink = (section: SettingsSection) => `tx://settings/${section}`;

/** `tx://settings/network` → "network"; null for anything else. */
export function parseDeepLink(text: string): SettingsSection | null {
  const m = /^tx:\/\/settings(?:\/([a-z]+))?\/?$/i.exec(text.trim());
  if (!m) return null;
  const section = (m[1] ?? "general").toLowerCase();
  return isSettingsSection(section) ? section : null;
}

/** A dotted path into Settings, e.g. `network.listenPort`. */
export type SettingPath = string;

export function getPath(settings: Settings, path: SettingPath): unknown {
  return path.split(".").reduce<unknown>((at, key) => (at as Record<string, unknown> | undefined)?.[key], settings);
}

/** A copy of `settings` with `path` set to `value`. */
export function setPath(settings: Settings, path: SettingPath, value: unknown): Settings {
  const next = structuredClone(settings);
  const keys = path.split(".");
  let at = next as unknown as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) at = at[key] as Record<string, unknown>;
  at[keys[keys.length - 1]] = value;
  return next;
}

/**
 * `save`: sent as soon as it changes. `restart`: restarts the engine, so it waits for "Restart engine".
 * `apply`: who can reach the server and how they log in, so it waits for an explicit Apply.
 */
export type ChangeClass = "save" | "restart" | "apply";

export function changeClass(path: SettingPath, engine: EngineKind): ChangeClass {
  if (path.startsWith("server.") || path.startsWith("auth.")) return "apply";
  if (path.startsWith("engine.") || path.startsWith("network.proxy.") || path === "network.listenPort") return "restart";
  // librqbit only reads these when its session starts; Transmission applies them live.
  if (engine === "rqbit" && (path === "network.upnp" || path === "advanced.dht")) return "restart";
  return "save";
}

/** The body for `PUT /settings`: the server's settings with `changes` applied; write-only flags left out. */
export function settingsBody(base: Settings, changes: Record<SettingPath, unknown>): Settings {
  let body = structuredClone(base);
  delete body.network.proxy.hasPassword;
  delete body.engine.transmission.hasPassword;
  for (const [path, value] of Object.entries(changes)) body = setPath(body, path, value);
  return body;
}

/** A row anyone can search for; its title and description are `set.<id>` and `set.<id>.desc`. */
export interface RowDef {
  id: string;
  section: SettingsSection;
}

const rows = (section: SettingsSection, ids: string[]): RowDef[] => ids.map((id) => ({ id, section }));

export const ROWS: RowDef[] = [
  ...rows("general", ["startWithSystem", "startMinimized", "confirmExit", "checkForUpdates", "language", "player"]),
  ...rows("engine", [
    "engineKind",
    "downloadDir",
    "trHost",
    "trPort",
    "trPath",
    "trHttps",
    "trUsername",
    "trPassword",
    "trTest",
    "diskCache",
    "osCache",
    "superSeeding",
    "sequential",
    "webSocket",
    "anonymous",
  ]),
  ...rows("network", [
    "listenPort",
    "upnp",
    "portTest",
    "dht",
    "pex",
    "lpd",
    "encryption",
    "proxyType",
    "proxyAddress",
    "proxyAuth",
    "proxyUsername",
    "proxyPassword",
    "proxyUnsupported",
  ]),
  ...rows("bandwidth", ["maxDownload", "maxUpload", "maxConnections"]),
  ...rows("queue", [
    "maxActiveDownloads",
    "maxActiveTorrents",
    "startAutomatically",
    "defaultPriority",
    "seedAutomatically",
    "minRatio",
    "minSeedingTime",
  ]),
  ...rows("folders", ["defaultSavePath", "createSubfolder", "moveCompleted", "moveCompletedPath"]),
  ...rows("tabs", ["grammar", "savedTabs"]),
  ...rows("security", ["bind", "serverPort", "allowedHosts", "authEnabled", "authUsername", "authPassword"]),
  ...rows("notifications", ["notifyEnabled", "notifyComplete", "notifyAdd", "notifySound"]),
  ...rows("appearance", ["mode", "accent", "speedGraph", "pieceMap", "dateFormat"]),
  ...rows("about", ["version", "checkNow"]),
];

export interface RowHit extends RowDef {
  title: string;
  desc: string;
}

/** Rows whose title, description or section name contain every word of `query`; titles matches first. */
export function searchRows(query: string, label: (row: RowDef) => { title: string; desc: string; section: string }): RowHit[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const titleRank = (title: string) => (words.every((w) => title.toLowerCase().includes(w)) ? 0 : 1);
  return ROWS.flatMap((row) => {
    const { title, desc, section } = label(row);
    const hay = `${title} ${desc} ${section}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return [];
    return [{ ...row, title, desc }];
  }).sort((a, b) => titleRank(a.title) - titleRank(b.title));
}

/** A random port in the dynamic range, never `current`. */
export function randomPort(current: number, random = Math.random): number {
  const port = 49152 + Math.floor(random() * (65535 - 49152));
  return port === current ? port + 1 : port;
}

/** The row that edits each staged path, for naming changes in the restart notice. */
export const PATH_ROW: Record<SettingPath, string> = {
  "network.listenPort": "listenPort",
  "network.upnp": "upnp",
  "advanced.dht": "dht",
  "engine.kind": "engineKind",
  "engine.rqbit.downloadDir": "downloadDir",
  "engine.transmission.host": "trHost",
  "engine.transmission.port": "trPort",
  "engine.transmission.path": "trPath",
  "engine.transmission.https": "trHttps",
  "engine.transmission.username": "trUsername",
  "engine.transmission.password": "trPassword",
  "network.proxy.type": "proxyType",
  "network.proxy.host": "proxyAddress",
  "network.proxy.port": "proxyAddress",
  "network.proxy.authRequired": "proxyAuth",
  "network.proxy.username": "proxyUsername",
  "network.proxy.password": "proxyPassword",
};
