import { useEffect, useState, type ReactNode } from "react";
import {
  X,
  Monitor,
  Wifi,
  Download,
  Brush,
  Wrench,
  Save,
  RefreshCw,
  Check,
  ToggleLeft,
  ToggleRight,
  Sliders,
  Server,
  Shield,
  AlertTriangle,
} from "lucide-react";
import {
  api,
  type EngineKind,
  type Language,
  type Priority,
  type ProxyKind,
  type Settings as SettingsData,
  type Theme,
  type DateFormat,
} from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { isLoopback, isNewer } from "../lib/format";
import { LANGUAGES } from "../lib/i18n";
import type { Release } from "../lib/updates";

interface SettingsProps {
  onClose: () => void;
  onSaved: (settings: SettingsData) => void;
  onError: (e: unknown) => void;
  engineError: string | null;
  version: string | undefined;
  checkUpdates: () => Promise<Release | null>;
}

type Section = "general" | "network" | "downloads" | "remote" | "appearance" | "advanced" | "server";

const SECTIONS: { id: Section; icon: ReactNode }[] = [
  { id: "general", icon: <Monitor size={14} /> },
  { id: "network", icon: <Wifi size={14} /> },
  { id: "downloads", icon: <Download size={14} /> },
  { id: "remote", icon: <Server size={14} /> },
  { id: "appearance", icon: <Brush size={14} /> },
  { id: "advanced", icon: <Wrench size={14} /> },
  { id: "server", icon: <Shield size={14} /> },
];

const field =
  "bg-tx-surface-900 border border-tx-accent-900/50 rounded text-sm text-tx-accent-400 focus:outline-none focus:ring-1 focus:ring-tx-accent-700 disabled:opacity-50";
const smallButton =
  "flex items-center text-xs bg-tx-accent-900/30 hover:bg-tx-accent-900/50 text-tx-accent-400 py-1.5 px-3 rounded-md transition-colors disabled:opacity-50";
const heading = "text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mb-3";

const THEMES: { id: Theme; box: string; text: string }[] = [
  { id: "hacker", box: "bg-black", text: "text-green-500" },
  { id: "dark-blue", box: "bg-slate-900", text: "text-blue-400" },
  { id: "light", box: "bg-gray-100", text: "text-gray-800" },
];

export function Settings({ onClose, onSaved, onError, engineError, version, checkUpdates }: SettingsProps) {
  const { t, gate } = useUi();
  const [activeTab, setActiveTab] = useState<Section>("general");
  const [s, setS] = useState<SettingsData | null>(null);
  // Write-only secrets: only sent when the user typed something.
  const [authPassword, setAuthPassword] = useState("");
  const [trPassword, setTrPassword] = useState<string | undefined>(undefined);
  const [proxyPassword, setProxyPassword] = useState<string | undefined>(undefined);
  const [hosts, setHosts] = useState("");
  const [remoteAuth, setRemoteAuth] = useState(false);
  const [testStatus, setTestStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getSettings().then((data) => {
      setS(data);
      setHosts(data.server.allowedHosts.join(", "));
      setRemoteAuth(!!data.engine.transmission.username || !!data.engine.transmission.hasPassword);
    }, onError);
  }, [onError]);

  if (!s) return null;

  const update = (fn: (draft: SettingsData) => void) =>
    setS((prev) => {
      const next = structuredClone(prev!);
      fn(next);
      return next;
    });

  const exposedWithoutAuth = !isLoopback(s.server.bind) && !s.auth.enabled;
  const tr = s.engine.transmission;
  const rpcUrl = `${tr.https ? "https" : "http"}://${tr.host}:${tr.port}${tr.path}`;

  const transmissionBody = () => {
    const body = structuredClone(tr);
    delete body.hasPassword;
    if (!remoteAuth) {
      body.username = "";
      body.password = "";
    } else if (trPassword !== undefined) body.password = trPassword;
    return body;
  };

  const saveSettings = async () => {
    setBusy(true);
    setError(null);
    setSavedStatus("settings.saving");
    const body: SettingsData = structuredClone(s);
    body.server.allowedHosts = hosts.split(",").map((h) => h.trim()).filter(Boolean);
    if (authPassword) body.auth.password = authPassword;
    body.engine.transmission = transmissionBody();
    delete body.network.proxy.hasPassword;
    if (proxyPassword !== undefined) body.network.proxy.password = proxyPassword;
    try {
      const res = await api.saveSettings(body);
      setS(res.settings);
      setAuthPassword("");
      setTrPassword(undefined);
      setProxyPassword(undefined);
      setSavedStatus(res.restartRequired ? "settings.savedRestart" : "settings.saved");
      onSaved(res.settings);
    } catch (e) {
      setSavedStatus(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const testConnection = async () => {
    setTestStatus({ ok: true, text: t("settings.remote.testing") });
    try {
      await api.testTransmission(transmissionBody());
      setTestStatus({ ok: true, text: t("settings.remote.testOk") });
    } catch (e) {
      setTestStatus({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const runUpdateCheck = async () => {
    setUpdateStatus(t("settings.general.checking"));
    try {
      const r = await checkUpdates();
      setUpdateStatus(
        r && version && isNewer(r.version, version)
          ? t("update.available", { version: r.version })
          : t("settings.general.latest", { version: version ?? "?" }),
      );
    } catch (e) {
      setUpdateStatus(e instanceof Error ? e.message : String(e));
    }
  };

  const describe = (description?: string, hint?: string, badge?: string) => (
    <>
      {description && <p className="text-xs text-tx-accent-700 mt-0.5">{description}</p>}
      {badge && <p className="text-xs text-yellow-500/80 mt-0.5">{badge}</p>}
      {hint && <p className="text-xs text-yellow-500/80 mt-0.5">{hint}</p>}
    </>
  );

  const renderToggle = (
    isEnabled: boolean,
    onChange: (v: boolean) => void,
    label: string,
    opts: { description?: string; hint?: string; badge?: string } = {},
  ) => (
    <div className="flex items-center justify-between py-3 border-b border-tx-accent-900/20" title={opts.hint}>
      <div className={opts.hint ? "opacity-60" : ""}>
        <h4 className="text-sm text-tx-accent-400">{label}</h4>
        {describe(opts.description, opts.hint, opts.badge)}
      </div>
      <button
        className="text-tx-accent-500 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
        onClick={() => onChange(!isEnabled)}
        disabled={!!opts.hint}
        role="switch"
        aria-checked={isEnabled}
        aria-label={label}
      >
        {isEnabled ? (
          <ToggleRight size={20} className="text-tx-accent-500" />
        ) : (
          <ToggleLeft size={20} className="text-tx-accent-700" />
        )}
      </button>
    </div>
  );

  const renderNumberInput = (
    label: string,
    value: number,
    onChange: (value: number) => void,
    opts: { min: number; max: number; unit?: string; description?: string; hint?: string; step?: number },
  ) => (
    <div className="flex items-center justify-between py-3 border-b border-tx-accent-900/20" title={opts.hint}>
      <div className={opts.hint ? "opacity-60" : ""}>
        <h4 className="text-sm text-tx-accent-400">{label}</h4>
        {describe(opts.description, opts.hint)}
      </div>
      <div className="flex items-center">
        <input
          type="number"
          className={`w-20 px-2 py-1 ${field}`}
          value={value}
          disabled={!!opts.hint}
          step={opts.step ?? 1}
          onChange={(e) => {
            const n = opts.step ? parseFloat(e.target.value) : parseInt(e.target.value, 10);
            onChange(Number.isFinite(n) ? n : opts.min);
          }}
          min={opts.min}
          max={opts.max}
        />
        {opts.unit && <span className="ml-2 text-sm text-tx-accent-500">{opts.unit}</span>}
      </div>
    </div>
  );

  const renderTextInput = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    opts: { placeholder?: string; description?: string; type?: string; hint?: string } = {},
  ) => (
    <div className="py-3 border-b border-tx-accent-900/20" title={opts.hint}>
      <div className={`mb-2 ${opts.hint ? "opacity-60" : ""}`}>
        <h4 className="text-sm text-tx-accent-400">{label}</h4>
        {describe(opts.description, opts.hint)}
      </div>
      <input
        type={opts.type ?? "text"}
        className={`w-full px-3 py-1.5 ${field}`}
        value={value}
        disabled={!!opts.hint}
        onChange={(e) => onChange(e.target.value)}
        placeholder={opts.placeholder}
      />
    </div>
  );

  const renderSelect = <V extends string>(
    label: string,
    value: V,
    onChange: (v: V) => void,
    options: { value: V; label: string; hint?: string }[],
    opts: { description?: string; hint?: string } = {},
  ) => (
    <div className="py-3 border-b border-tx-accent-900/20" title={opts.hint}>
      <div className={`mb-2 ${opts.hint ? "opacity-60" : ""}`}>
        <h4 className="text-sm text-tx-accent-400">{label}</h4>
        {describe(opts.description, opts.hint)}
      </div>
      <select
        className={`w-full px-3 py-1.5 ${field}`}
        value={value}
        disabled={!!opts.hint}
        onChange={(e) => onChange(e.target.value as V)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={!!o.hint} title={o.hint}>
            {o.hint ? `${o.label} (${o.hint})` : o.label}
          </option>
        ))}
      </select>
    </div>
  );

  const p = s.preferences;
  const n = s.network;
  const d = s.downloads;
  const a = s.advanced;
  const desktopOnly = t("settings.desktopOnly");
  const priorities: { value: Priority; label: string }[] = [
    { value: "low", label: t("details.priority.low") },
    { value: "normal", label: t("details.priority.normal") },
    { value: "high", label: t("details.priority.high") },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-2">
            <h3 className={heading}>{t("settings.general.behavior")}</h3>
            {renderToggle(p.startWithSystem, (v) => update((x) => void (x.preferences.startWithSystem = v)), t("settings.general.startWithSystem"), { description: t("settings.general.startWithSystemDesc"), badge: desktopOnly })}
            {renderToggle(p.startMinimized, (v) => update((x) => void (x.preferences.startMinimized = v)), t("settings.general.startMinimized"), { description: t("settings.general.startMinimizedDesc"), badge: desktopOnly })}
            {renderToggle(p.confirmExitWhileDownloading, (v) => update((x) => void (x.preferences.confirmExitWhileDownloading = v)), t("settings.general.confirmExit"), { description: t("settings.general.confirmExitDesc"), badge: desktopOnly })}
            <h3 className={`${heading} mt-6`}>{t("settings.general.updates")}</h3>
            {renderToggle(p.checkForUpdates, (v) => update((x) => void (x.preferences.checkForUpdates = v)), t("settings.general.checkForUpdates"))}
            <div className="pt-2 flex">
              <button className={smallButton} onClick={runUpdateCheck}>
                <RefreshCw size={12} className="mr-1.5" />
                {t("settings.general.checkNow")}
              </button>
              {updateStatus && (
                <div className="ml-3 text-xs text-tx-accent-500 flex items-center">
                  <Check size={12} className="mr-1.5" />
                  {updateStatus}
                </div>
              )}
            </div>
            <h3 className={`${heading} mt-6`}>{t("settings.general.language")}</h3>
            {renderSelect<Language>(t("settings.general.interfaceLanguage"), p.language, (v) => update((x) => void (x.preferences.language = v)), LANGUAGES)}
          </div>
        );

      case "network": {
        const proxyHint = gate(`proxy${n.proxy.type === "http" ? "Http" : n.proxy.type === "socks4" ? "Socks4" : "Socks5"}`);
        const proxyOff = n.proxy.type === "none" ? t("settings.network.proxyNone") : proxyHint;
        return (
          <div className="space-y-2">
            <h3 className={heading}>{t("settings.network.connection")}</h3>
            {renderNumberInput(t("settings.network.maxConnections"), n.maxConnectionsPerTorrent, (v) => update((x) => void (x.network.maxConnectionsPerTorrent = v)), { min: 1, max: 5000, unit: t("settings.network.connections"), description: t("settings.network.maxConnectionsDesc"), hint: gate("maxConnectionsPerTorrent") })}
            {renderNumberInput(t("settings.network.maxUpload"), n.maxUploadKBps, (v) => update((x) => void (x.network.maxUploadKBps = v)), { min: 0, max: 10_000_000, unit: "KB/s", description: t("settings.network.unlimited"), hint: gate("speedLimits") })}
            {renderNumberInput(t("settings.network.maxDownload"), n.maxDownloadKBps, (v) => update((x) => void (x.network.maxDownloadKBps = v)), { min: 0, max: 10_000_000, unit: "KB/s", description: t("settings.network.unlimited"), hint: gate("speedLimits") })}
            <h3 className={`${heading} mt-6`}>{t("settings.network.listenPort")}</h3>
            {renderNumberInput(t("settings.network.port"), n.listenPort, (v) => update((x) => void (x.network.listenPort = v)), { min: 1024, max: 65535, hint: gate("listenPort") })}
            {renderToggle(n.upnp, (v) => update((x) => void (x.network.upnp = v)), t("settings.network.upnp"), { description: t("settings.network.upnpDesc"), hint: gate("upnp") })}
            <h3 className={`${heading} mt-6`}>{t("settings.network.proxy")}</h3>
            {renderSelect<ProxyKind>(t("settings.network.proxyType"), n.proxy.type, (v) => update((x) => void (x.network.proxy.type = v)), [
              { value: "none", label: t("settings.network.proxyNoneOption") },
              { value: "http", label: "HTTP", hint: gate("proxyHttp") },
              { value: "socks4", label: "SOCKS4", hint: gate("proxySocks4") },
              { value: "socks5", label: "SOCKS5", hint: gate("proxySocks5") },
            ])}
            {renderTextInput(t("settings.network.proxyHost"), n.proxy.host, (v) => update((x) => void (x.network.proxy.host = v)), { placeholder: "host.example.com", hint: proxyOff })}
            {renderNumberInput(t("settings.network.proxyPort"), n.proxy.port, (v) => update((x) => void (x.network.proxy.port = v)), { min: 1, max: 65535, hint: proxyOff })}
            {renderToggle(n.proxy.authRequired, (v) => update((x) => void (x.network.proxy.authRequired = v)), t("settings.network.proxyAuth"), { hint: proxyOff })}
            {n.proxy.authRequired && (
              <>
                {renderTextInput(t("settings.username"), n.proxy.username, (v) => update((x) => void (x.network.proxy.username = v)), { hint: proxyOff })}
                {renderTextInput(t("settings.password"), proxyPassword ?? "", setProxyPassword, { type: "password", placeholder: n.proxy.hasPassword ? t("settings.unchanged") : "", hint: proxyOff })}
              </>
            )}
          </div>
        );
      }

      case "downloads":
        return (
          <div className="space-y-2">
            <h3 className={heading}>{t("settings.downloads.saveLocation")}</h3>
            {renderTextInput(t("settings.downloads.defaultPath"), d.defaultSavePath, (v) => update((x) => void (x.downloads.defaultSavePath = v)), { placeholder: s.engine.rqbit.downloadDir, description: t("settings.downloads.defaultPathDesc") })}
            {renderToggle(d.createSubfolder, (v) => update((x) => void (x.downloads.createSubfolder = v)), t("settings.downloads.createSubfolder"))}
            {renderToggle(d.moveCompletedEnabled, (v) => update((x) => void (x.downloads.moveCompletedEnabled = v)), t("settings.downloads.moveCompleted"), { description: t("settings.downloads.moveCompletedDesc"), hint: gate("moveCompleted") })}
            {renderTextInput(t("settings.downloads.moveCompletedPath"), d.moveCompletedPath, (v) => update((x) => void (x.downloads.moveCompletedPath = v)), { hint: gate("moveCompleted") ?? (d.moveCompletedEnabled ? undefined : t("settings.downloads.moveCompletedOff")) })}
            <h3 className={`${heading} mt-6`}>{t("settings.downloads.management")}</h3>
            {renderNumberInput(t("settings.downloads.maxActiveDownloads"), d.maxActiveDownloads, (v) => update((x) => void (x.downloads.maxActiveDownloads = v)), { min: 1, max: 500, hint: gate("queue") })}
            {renderNumberInput(t("settings.downloads.maxActiveTorrents"), d.maxActiveTorrents, (v) => update((x) => void (x.downloads.maxActiveTorrents = v)), { min: 1, max: 1000, hint: gate("queue") })}
            {renderToggle(d.startAutomatically, (v) => update((x) => void (x.downloads.startAutomatically = v)), t("settings.downloads.startAutomatically"))}
            {renderSelect<Priority>(t("settings.downloads.defaultPriority"), d.defaultPriority, (v) => update((x) => void (x.downloads.defaultPriority = v)), priorities, { hint: gate("torrentPriority") })}
            <h3 className={`${heading} mt-6`}>{t("settings.downloads.seeding")}</h3>
            {renderToggle(d.seedAutomatically, (v) => update((x) => void (x.downloads.seedAutomatically = v)), t("settings.downloads.seedAutomatically"))}
            {renderNumberInput(t("settings.downloads.minRatio"), d.minRatio, (v) => update((x) => void (x.downloads.minRatio = v)), { min: 0, max: 100, step: 0.1, description: t("settings.downloads.minRatioDesc"), hint: gate("seedLimits") })}
            {renderNumberInput(t("settings.downloads.minSeedingTime"), d.minSeedingMinutes, (v) => update((x) => void (x.downloads.minSeedingMinutes = v)), { min: 0, max: 1_000_000, unit: t("settings.downloads.minutes"), description: t("settings.downloads.minSeedingTimeDesc"), hint: gate("seedLimits") })}
          </div>
        );

      case "remote":
        return (
          <div className="space-y-2">
            <h3 className={heading}>{t("settings.remote.title")}</h3>
            <p className="text-xs text-tx-accent-600 mb-4">{t("settings.remote.desc")}</p>
            {renderTextInput(t("settings.remote.host"), tr.host, (v) => update((x) => void (x.engine.transmission.host = v)), { placeholder: "localhost", description: t("settings.remote.hostDesc") })}
            {renderNumberInput(t("settings.remote.port"), tr.port, (v) => update((x) => void (x.engine.transmission.port = v)), { min: 1, max: 65535, description: t("settings.remote.portDesc") })}
            {renderTextInput(t("settings.remote.path"), tr.path, (v) => update((x) => void (x.engine.transmission.path = v)), { placeholder: "/transmission/rpc" })}
            {renderToggle(tr.https, (v) => update((x) => void (x.engine.transmission.https = v)), t("settings.remote.https"))}
            {renderToggle(remoteAuth, setRemoteAuth, t("settings.remote.auth"), { description: t("settings.remote.authDesc") })}
            {remoteAuth && (
              <>
                {renderTextInput(t("settings.username"), tr.username, (v) => update((x) => void (x.engine.transmission.username = v)), { placeholder: "username" })}
                {renderTextInput(t("settings.password"), trPassword ?? "", setTrPassword, { type: "password", placeholder: tr.hasPassword ? t("settings.unchanged") : "••••••••" })}
              </>
            )}
            <div className="pt-4 flex items-center">
              <button className={smallButton} onClick={testConnection}>
                <Wifi size={12} className="mr-1.5" />
                {t("settings.remote.test")}
              </button>
              {testStatus && (
                <span className={`ml-3 text-xs break-all ${testStatus.ok ? "text-tx-accent-500" : "text-red-400"}`}>
                  {testStatus.text}
                </span>
              )}
            </div>
            <div className="mt-6 bg-tx-surface-900/50 border border-tx-accent-900/30 rounded-md p-3">
              <h4 className="text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mb-2">
                {t("settings.remote.details")}
              </h4>
              <div className="space-y-1 text-xs text-tx-accent-500">
                <div className="flex justify-between gap-4">
                  <span className="text-tx-accent-700">URL:</span>
                  <span className="font-mono break-all">{rpcUrl}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-tx-accent-700">{t("settings.remote.authLabel")}</span>
                  <span>{remoteAuth ? t("settings.enabled") : t("settings.disabled")}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-tx-accent-700">{t("settings.remote.status")}</span>
                  <span className={s.engine.kind === "transmission" && engineError ? "text-red-400 break-all" : ""}>
                    {s.engine.kind !== "transmission"
                      ? t("settings.remote.inactive")
                      : engineError ?? t("settings.remote.connected")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      case "appearance":
        return (
          <div className="space-y-2">
            <h3 className={heading}>{t("settings.appearance.theme")}</h3>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  onClick={() => update((x) => void (x.preferences.theme = th.id))}
                  className={`p-1 rounded ${p.theme === th.id ? "border-2 border-tx-accent-500" : "border border-tx-accent-900/30"}`}
                >
                  <div className={`${th.box} h-20 rounded flex items-center justify-center`}>
                    <span className={`${th.text} text-xs`}>{t(`theme.${th.id}`)}</span>
                  </div>
                </button>
              ))}
            </div>
            {renderToggle(p.useSystemTheme, (v) => update((x) => void (x.preferences.useSystemTheme = v)), t("settings.appearance.systemTheme"), { description: t("settings.appearance.systemThemeDesc") })}
            <h3 className={`${heading} mt-6`}>{t("settings.appearance.display")}</h3>
            {renderToggle(p.showSpeedGraph, (v) => update((x) => void (x.preferences.showSpeedGraph = v)), t("settings.appearance.speedGraph"))}
            {renderToggle(p.showPieceMap, (v) => update((x) => void (x.preferences.showPieceMap = v)), t("settings.appearance.pieceMap"))}
            {renderSelect<DateFormat>(t("settings.appearance.dateFormat"), p.dateFormat, (v) => update((x) => void (x.preferences.dateFormat = v)), [
              { value: "relative", label: t("settings.appearance.dateRelative") },
              { value: "absolute", label: t("settings.appearance.dateAbsolute") },
              { value: "iso", label: t("settings.appearance.dateIso") },
            ])}
            <h3 className={`${heading} mt-6`}>{t("settings.appearance.notifications")}</h3>
            {renderToggle(p.notifications.enabled, (v) => update((x) => void (x.preferences.notifications.enabled = v)), t("settings.appearance.notifyEnabled"))}
            {renderToggle(p.notifications.onComplete, (v) => update((x) => void (x.preferences.notifications.onComplete = v)), t("settings.appearance.notifyComplete"))}
            {renderToggle(p.notifications.onAdd, (v) => update((x) => void (x.preferences.notifications.onAdd = v)), t("settings.appearance.notifyAdd"))}
            {renderToggle(p.notifications.sound, (v) => update((x) => void (x.preferences.notifications.sound = v)), t("settings.appearance.notifySound"))}
          </div>
        );

      case "advanced":
        return (
          <div className="space-y-2">
            <div className="bg-yellow-900/20 border-l-4 border-yellow-500 p-3 mb-4 rounded">
              <p className="text-xs text-yellow-400">{t("settings.advanced.warning")}</p>
            </div>
            <h3 className={heading}>{t("settings.advanced.performance")}</h3>
            {renderNumberInput(t("settings.advanced.diskCache"), a.diskCacheMB, (v) => update((x) => void (x.advanced.diskCacheMB = v)), { min: 0, max: 16384, unit: "MB", description: t("settings.advanced.diskCacheDesc"), hint: gate("diskCache") })}
            {renderToggle(a.osCache, (v) => update((x) => void (x.advanced.osCache = v)), t("settings.advanced.osCache"), { hint: gate("osCache") })}
            {renderToggle(a.superSeeding, (v) => update((x) => void (x.advanced.superSeeding = v)), t("settings.advanced.superSeeding"), { description: t("settings.advanced.superSeedingDesc"), hint: gate("superSeeding") })}
            <h3 className={`${heading} mt-6`}>{t("settings.advanced.security")}</h3>
            {renderToggle(a.dht, (v) => update((x) => void (x.advanced.dht = v)), t("settings.advanced.dht"), { description: t("settings.advanced.dhtDesc"), hint: gate("dht") })}
            {renderToggle(a.pex, (v) => update((x) => void (x.advanced.pex = v)), t("settings.advanced.pex"), { description: t("settings.advanced.pexDesc"), hint: gate("pex") })}
            {renderToggle(a.lpd, (v) => update((x) => void (x.advanced.lpd = v)), t("settings.advanced.lpd"), { hint: gate("lpd") })}
            {renderToggle(a.anonymousMode, (v) => update((x) => void (x.advanced.anonymousMode = v)), t("settings.advanced.anonymous"), { description: t("settings.advanced.anonymousDesc"), hint: gate("anonymousMode") })}
            <h3 className={`${heading} mt-6`}>{t("settings.advanced.experimental")}</h3>
            {renderToggle(a.sequentialDownload, (v) => update((x) => void (x.advanced.sequentialDownload = v)), t("settings.advanced.sequential"), { hint: gate("sequentialDownload") })}
            {renderToggle(a.webSocketTrackers, (v) => update((x) => void (x.advanced.webSocketTrackers = v)), t("settings.advanced.webSocket"), { hint: gate("webSocketTrackers") })}
          </div>
        );

      case "server":
        return (
          <div className="space-y-2">
            <h3 className={heading}>{t("settings.server.listen")}</h3>
            {renderTextInput(t("settings.server.bind"), s.server.bind, (v) => update((x) => void (x.server.bind = v)), { description: t("settings.server.bindDesc") })}
            {renderNumberInput(t("settings.server.port"), s.server.port, (v) => update((x) => void (x.server.port = v)), { min: 1, max: 65535 })}
            {renderTextInput(t("settings.server.allowedHosts"), hosts, setHosts, { placeholder: "nas.local", description: t("settings.server.allowedHostsDesc") })}
            {exposedWithoutAuth && (
              <p className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-950/40 border border-yellow-900/60 rounded p-2 mt-2">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                {t("settings.server.exposed")}
              </p>
            )}
            <h3 className={`${heading} mt-6`}>{t("settings.server.auth")}</h3>
            {renderToggle(s.auth.enabled, (v) => update((x) => void (x.auth.enabled = v)), t("settings.server.authEnabled"))}
            {s.auth.enabled && (
              <>
                {renderTextInput(t("settings.username"), s.auth.username, (v) => update((x) => void (x.auth.username = v)))}
                {renderTextInput(t("settings.password"), authPassword, setAuthPassword, { type: "password", description: t("settings.server.passwordDesc") })}
              </>
            )}
            <h3 className={`${heading} mt-6`}>{t("settings.server.engine")}</h3>
            {renderSelect<EngineKind>(t("settings.server.engineKind"), s.engine.kind, (v) => update((x) => void (x.engine.kind = v)), [
              { value: "rqbit", label: t("settings.server.rqbit") },
              { value: "transmission", label: t("settings.server.transmission") },
            ], { description: s.engine.kind === "transmission" ? t("settings.server.transmissionDesc") : undefined })}
            {renderTextInput(t("settings.server.downloadDir"), s.engine.rqbit.downloadDir, (v) => update((x) => void (x.engine.rqbit.downloadDir = v)), { description: t("settings.server.downloadDirDesc") })}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-tx-base/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-tx-surface-950 border border-tx-accent-900/50 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-tx-accent-900/30">
          <h2 className="text-tx-accent-400 font-semibold flex items-center">
            <Sliders size={16} className="mr-2" />
            {t("settings.title")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-tx-accent-500 hover:text-tx-accent-400 p-1 rounded-md hover:bg-tx-surface-900 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="w-48 border-r border-tx-accent-900/30 p-4 bg-tx-base/30">
            {SECTIONS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-3 py-2 mb-1 rounded-md text-sm ${activeTab === tab.id ? "bg-tx-accent-900/20 text-tx-accent-400" : "text-tx-accent-600 hover:bg-tx-surface-900 hover:text-tx-accent-500"}`}
              >
                <span className="mr-2">{tab.icon}</span>
                <span>{t(`settings.section.${tab.id}`)}</span>
              </button>
            ))}
          </div>
          <div className="flex-1 p-4 overflow-y-auto">{renderTabContent()}</div>
        </div>
        <div className="border-t border-tx-accent-900/30 p-4 bg-tx-base/30 flex items-center justify-between gap-3">
          <div className="text-xs flex items-center min-w-0">
            {error ? (
              <span className="text-red-400 break-all">{error}</span>
            ) : (
              savedStatus && (
                <span className="text-tx-accent-500 flex items-center">
                  <Check size={12} className="mr-1.5 shrink-0" />
                  {t(savedStatus)}
                </span>
              )
            )}
          </div>
          <div className="flex space-x-3 shrink-0">
            <button
              onClick={onClose}
              className="text-xs bg-tx-surface-800 hover:bg-tx-surface-700 text-tx-accent-400 py-1.5 px-4 rounded-md transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={saveSettings}
              disabled={busy}
              className="flex items-center text-xs bg-tx-accent-800 hover:bg-tx-accent-700 text-tx-accent-100 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              <Save size={12} className="mr-1.5" />
              {t("settings.save")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
