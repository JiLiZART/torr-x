// Every settings section except Network, all built from the same Row pattern.
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { api, type Accent, type DateFormat, type EngineKind, type Language, type Mode, type Priority, type TransmissionSettings } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import { isLoopback, isNewer } from "../../lib/format";
import { LANGUAGES } from "../../lib/i18n";
import type { Release } from "../../lib/updates";
import { Button, Chip, Group, NumberInput, Row, Select, TextInput, Toggle } from "./rows";
import type { RowStatus, SettingsStore } from "./useSettingsStore";

export interface SectionProps {
  store: SettingsStore;
  /** Props for the row `id` editing `path`: its save state and search highlight. */
  row: (id: string, path?: string) => { id: string; status?: RowStatus; focused: boolean };
  onError: (e: unknown) => void;
}

const MAX_RATE = 10_000_000;

export function GeneralSection({ store, row }: SectionProps) {
  const { t } = useUi();
  const v = store.value;
  const desktop = t("set.group.desktopOnly");
  return (
    <>
      <Group title={t("set.group.startup")} caption={desktop}>
        <Row {...row("startWithSystem", "preferences.startWithSystem")}>
          <Toggle label={t("set.startWithSystem")} on={v("preferences.startWithSystem")} onChange={(on) => store.change("preferences.startWithSystem", on)} />
        </Row>
        <Row {...row("startMinimized", "preferences.startMinimized")}>
          <Toggle label={t("set.startMinimized")} on={v("preferences.startMinimized")} onChange={(on) => store.change("preferences.startMinimized", on)} />
        </Row>
        <Row {...row("confirmExit", "preferences.confirmExitWhileDownloading")}>
          <Toggle label={t("set.confirmExit")} on={v("preferences.confirmExitWhileDownloading")} onChange={(on) => store.change("preferences.confirmExitWhileDownloading", on)} />
        </Row>
      </Group>
      <Group title={t("set.group.updates")}>
        <Row {...row("checkForUpdates", "preferences.checkForUpdates")}>
          <Toggle label={t("set.checkForUpdates")} on={v("preferences.checkForUpdates")} onChange={(on) => store.change("preferences.checkForUpdates", on)} />
        </Row>
      </Group>
      <Group title={t("set.group.language")}>
        <Row {...row("language", "preferences.language")}>
          <Select<Language> label={t("set.language")} value={v("preferences.language")} onChange={(next) => store.change("preferences.language", next)} options={LANGUAGES} />
        </Row>
      </Group>
    </>
  );
}

export function EngineSection({ store, row, engineError }: SectionProps & { engineError: string | null }) {
  const { t, gate, caps } = useUi();
  const v = store.value;
  const kind = v<EngineKind>("engine.kind");
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null);
  const tr: TransmissionSettings = {
    host: v("engine.transmission.host"),
    port: v("engine.transmission.port"),
    path: v("engine.transmission.path"),
    https: v("engine.transmission.https"),
    username: v("engine.transmission.username"),
    password: v<string | undefined>("engine.transmission.password"),
  };
  const runTest = async () => {
    setTest({ ok: true, text: t("set.trTest.testing") });
    try {
      await api.testTransmission(tr);
      setTest({ ok: true, text: t("set.trTest.ok") });
    } catch (e) {
      setTest({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };
  const active = store.saved?.engine.kind;
  return (
    <>
      <section className="flex w-full shrink-0 flex-col gap-[6px] rounded-[12px] border border-ui-border bg-ui-surface px-[16px] py-[12px]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[13px] font-semibold text-ui-text">{caps?.engine ?? active}</span>
          {caps?.version && <span className="font-code text-[11px] text-ui-accent">{caps.version}</span>}
          <span className="font-code text-[10px] text-ui-text-3">{active === "transmission" ? t("set.engine.remote", { url: `${tr.host}:${tr.port}` }) : t("set.engine.embedded")}</span>
          <span className="flex-1" />
          <Chip tone={engineError ? "bad" : "good"}>{engineError ? t("set.engine.unavailable") : t("set.engine.connected")}</Chip>
        </div>
        {engineError && <span className="break-all text-[11px] text-ui-red">{engineError}</span>}
        <span className="font-code text-[10px] text-ui-text-3">{t("set.engine.capsNote")}</span>
      </section>
      <Group title={t("set.group.engine")} caption={t("set.group.restartCaption")}>
        <Row {...row("engineKind", "engine.kind")}>
          <Select<EngineKind>
            label={t("set.engineKind")}
            value={kind}
            onChange={(next) => store.change("engine.kind", next)}
            options={[
              { value: "rqbit", label: t("set.engine.rqbit") },
              { value: "transmission", label: t("set.engine.transmission") },
            ]}
          />
        </Row>
        <Row {...row("downloadDir", "engine.rqbit.downloadDir")} muted={kind !== "rqbit"}>
          <TextInput label={t("set.downloadDir")} width="w-[260px]" value={v("engine.rqbit.downloadDir")} onCommit={(s) => store.change("engine.rqbit.downloadDir", s.trim())} />
        </Row>
      </Group>
      <Group title={t("set.group.transmission")} caption={t("set.group.transmissionCaption")}>
        <Row {...row("trHost", "engine.transmission.host")}>
          <TextInput label={t("set.trHost")} placeholder="localhost" value={tr.host} onCommit={(s) => store.change("engine.transmission.host", s.trim())} />
        </Row>
        <Row {...row("trPort", "engine.transmission.port")}>
          <NumberInput label={t("set.trPort")} min={1} max={65535} value={tr.port} onCommit={(n) => store.change("engine.transmission.port", n)} />
        </Row>
        <Row {...row("trPath", "engine.transmission.path")}>
          <TextInput label={t("set.trPath")} placeholder="/transmission/rpc" value={tr.path} onCommit={(s) => store.change("engine.transmission.path", s.trim())} />
        </Row>
        <Row {...row("trHttps", "engine.transmission.https")}>
          <Toggle label={t("set.trHttps")} on={tr.https} onChange={(on) => store.change("engine.transmission.https", on)} />
        </Row>
        <Row {...row("trUsername", "engine.transmission.username")}>
          <TextInput label={t("set.trUsername")} value={tr.username} onCommit={(s) => store.change("engine.transmission.username", s)} />
        </Row>
        <Row {...row("trPassword", "engine.transmission.password")}>
          <TextInput
            type="password"
            label={t("set.trPassword")}
            value={tr.password ?? ""}
            placeholder={store.saved?.engine.transmission.hasPassword ? t("set.unchanged") : ""}
            onCommit={(s) => store.change("engine.transmission.password", s)}
          />
        </Row>
        <Row {...row("trTest")} desc={test?.ok ? test.text : undefined} status={test && !test.ok ? { state: "error", message: test.text } : undefined}>
          <Button onClick={() => void runTest()}>{t("set.trTest")}</Button>
        </Row>
      </Group>
      <Group title={t("set.group.performance")}>
        <Row {...row("diskCache", "advanced.diskCacheMB")} unsupported={gate("diskCache")}>
          <NumberInput label={t("set.diskCache")} min={0} max={16384} unit="MB" value={v("advanced.diskCacheMB")} onCommit={(n) => store.change("advanced.diskCacheMB", n)} />
        </Row>
        <Row {...row("osCache", "advanced.osCache")} unsupported={gate("osCache")}>
          <Toggle label={t("set.osCache")} on={v("advanced.osCache")} onChange={(on) => store.change("advanced.osCache", on)} />
        </Row>
        <Row {...row("superSeeding", "advanced.superSeeding")} unsupported={gate("superSeeding")}>
          <Toggle label={t("set.superSeeding")} on={v("advanced.superSeeding")} onChange={(on) => store.change("advanced.superSeeding", on)} />
        </Row>
        <Row {...row("sequential", "advanced.sequentialDownload")} unsupported={gate("sequentialDownload")}>
          <Toggle label={t("set.sequential")} on={v("advanced.sequentialDownload")} onChange={(on) => store.change("advanced.sequentialDownload", on)} />
        </Row>
        <Row {...row("webSocket", "advanced.webSocketTrackers")} unsupported={gate("webSocketTrackers")}>
          <Toggle label={t("set.webSocket")} on={v("advanced.webSocketTrackers")} onChange={(on) => store.change("advanced.webSocketTrackers", on)} />
        </Row>
        <Row {...row("anonymous", "advanced.anonymousMode")} unsupported={gate("anonymousMode")}>
          <Toggle label={t("set.anonymous")} on={v("advanced.anonymousMode")} onChange={(on) => store.change("advanced.anonymousMode", on)} />
        </Row>
      </Group>
    </>
  );
}

export function BandwidthSection({ store, row }: SectionProps) {
  const { t, gate } = useUi();
  const v = store.value;
  return (
    <>
      <Group title={t("set.group.speed")} caption={t("set.group.speedCaption")}>
        <Row {...row("maxDownload", "network.maxDownloadKBps")} unsupported={gate("speedLimits")}>
          <NumberInput label={t("set.maxDownload")} min={0} max={MAX_RATE} unit="KB/s" value={v("network.maxDownloadKBps")} onCommit={(n) => store.change("network.maxDownloadKBps", n)} />
        </Row>
        <Row {...row("maxUpload", "network.maxUploadKBps")} unsupported={gate("speedLimits")}>
          <NumberInput label={t("set.maxUpload")} min={0} max={MAX_RATE} unit="KB/s" value={v("network.maxUploadKBps")} onCommit={(n) => store.change("network.maxUploadKBps", n)} />
        </Row>
      </Group>
      <Group title={t("set.group.connections")}>
        <Row {...row("maxConnections", "network.maxConnectionsPerTorrent")} unsupported={gate("maxConnectionsPerTorrent")}>
          <NumberInput label={t("set.maxConnections")} min={0} max={5000} value={v("network.maxConnectionsPerTorrent")} onCommit={(n) => store.change("network.maxConnectionsPerTorrent", n)} />
        </Row>
      </Group>
    </>
  );
}

export function QueueSection({ store, row }: SectionProps) {
  const { t, gate, caps } = useUi();
  const v = store.value;
  const via = (feature: string) => (caps?.features[feature]?.via === "server" ? t("set.group.viaServer") : undefined);
  return (
    <>
      <Group title={t("set.group.queue")} caption={via("queue")}>
        <Row {...row("maxActiveDownloads", "downloads.maxActiveDownloads")} unsupported={gate("queue")}>
          <NumberInput label={t("set.maxActiveDownloads")} min={0} max={500} value={v("downloads.maxActiveDownloads")} onCommit={(n) => store.change("downloads.maxActiveDownloads", n)} />
        </Row>
        <Row {...row("maxActiveTorrents", "downloads.maxActiveTorrents")} unsupported={gate("queue")}>
          <NumberInput label={t("set.maxActiveTorrents")} min={0} max={1000} value={v("downloads.maxActiveTorrents")} onCommit={(n) => store.change("downloads.maxActiveTorrents", n)} />
        </Row>
        <Row {...row("startAutomatically", "downloads.startAutomatically")}>
          <Toggle label={t("set.startAutomatically")} on={v("downloads.startAutomatically")} onChange={(on) => store.change("downloads.startAutomatically", on)} />
        </Row>
        <Row {...row("defaultPriority", "downloads.defaultPriority")} unsupported={gate("torrentPriority")}>
          <Select<Priority>
            label={t("set.defaultPriority")}
            width="w-[120px]"
            value={v("downloads.defaultPriority")}
            onChange={(next) => store.change("downloads.defaultPriority", next)}
            options={(["low", "normal", "high"] as const).map((value) => ({ value, label: t(`details.priority.${value}`) }))}
          />
        </Row>
      </Group>
      <Group title={t("set.group.seeding")} caption={via("seedLimits")}>
        <Row {...row("seedAutomatically", "downloads.seedAutomatically")}>
          <Toggle label={t("set.seedAutomatically")} on={v("downloads.seedAutomatically")} onChange={(on) => store.change("downloads.seedAutomatically", on)} />
        </Row>
        <Row {...row("minRatio", "downloads.minRatio")} unsupported={gate("seedLimits")}>
          <NumberInput label={t("set.minRatio")} min={0} max={100} decimal value={v("downloads.minRatio")} onCommit={(n) => store.change("downloads.minRatio", n)} />
        </Row>
        <Row {...row("minSeedingTime", "downloads.minSeedingMinutes")} unsupported={gate("seedLimits")}>
          <NumberInput label={t("set.minSeedingTime")} min={0} max={1_000_000} unit={t("set.minutes")} value={v("downloads.minSeedingMinutes")} onCommit={(n) => store.change("downloads.minSeedingMinutes", n)} />
        </Row>
      </Group>
    </>
  );
}

export function FoldersSection({ store, row }: SectionProps) {
  const { t, gate } = useUi();
  const v = store.value;
  const moving = v<boolean>("downloads.moveCompletedEnabled");
  return (
    <Group title={t("set.group.folders")} caption={t("set.group.foldersCaption")}>
      <Row {...row("defaultSavePath", "downloads.defaultSavePath")}>
        <TextInput label={t("set.defaultSavePath")} width="w-[260px]" placeholder={store.saved?.engine.rqbit.downloadDir} value={v("downloads.defaultSavePath")} onCommit={(s) => store.change("downloads.defaultSavePath", s.trim())} />
      </Row>
      <Row {...row("createSubfolder", "downloads.createSubfolder")}>
        <Toggle label={t("set.createSubfolder")} on={v("downloads.createSubfolder")} onChange={(on) => store.change("downloads.createSubfolder", on)} />
      </Row>
      <Row {...row("moveCompleted", "downloads.moveCompletedEnabled")} unsupported={gate("moveCompleted")}>
        <Toggle label={t("set.moveCompleted")} on={moving} onChange={(on) => store.change("downloads.moveCompletedEnabled", on)} />
      </Row>
      <Row {...row("moveCompletedPath", "downloads.moveCompletedPath")} unsupported={gate("moveCompleted")} muted={!moving}>
        <TextInput label={t("set.moveCompletedPath")} width="w-[260px]" disabled={!moving} value={v("downloads.moveCompletedPath")} onCommit={(s) => store.change("downloads.moveCompletedPath", s.trim())} />
      </Row>
    </Group>
  );
}

export function TabsSection({ row, grammarVersion, tabCount }: SectionProps & { grammarVersion: number | null; tabCount: number }) {
  const { t } = useUi();
  return (
    <Group title={t("set.group.tabs")}>
      <Row {...row("grammar")}>{grammarVersion !== null && <Chip tone="neutral">v{grammarVersion}</Chip>}</Row>
      <Row {...row("savedTabs")}>
        <Chip tone="neutral">{tabCount}</Chip>
      </Row>
    </Group>
  );
}

/** Who can reach the server and how they log in: staged, sent only with Apply. */
export function SecuritySection({ store, row }: SectionProps) {
  const { t } = useUi();
  const v = store.value;
  const auth = v<boolean>("auth.enabled");
  const exposed = !isLoopback(v("server.bind")) && !auth;
  const staged = Object.keys(store.exposure).length > 0;
  const [busy, setBusy] = useState(false);
  const apply = async () => {
    setBusy(true);
    await store.applyExposure();
    setBusy(false);
  };
  return (
    <>
      <Group title={t("set.group.server")} caption={t("set.group.applyCaption")}>
        <Row {...row("bind", "server.bind")}>
          <TextInput label={t("set.bind")} width="w-[160px]" value={v("server.bind")} onCommit={(s) => store.change("server.bind", s.trim())} />
        </Row>
        <Row {...row("serverPort", "server.port")}>
          <NumberInput label={t("set.serverPort")} min={1} max={65535} value={v("server.port")} onCommit={(n) => store.change("server.port", n)} />
        </Row>
        <Row {...row("allowedHosts", "server.allowedHosts")}>
          <TextInput
            label={t("set.allowedHosts")}
            placeholder="nas.local"
            value={v<string[]>("server.allowedHosts").join(", ")}
            onCommit={(s) => store.change("server.allowedHosts", s.split(",").map((h) => h.trim()).filter(Boolean))}
          />
        </Row>
      </Group>
      <Group title={t("set.group.auth")} caption={t("set.group.applyCaption")}>
        <Row {...row("authEnabled", "auth.enabled")}>
          <Toggle label={t("set.authEnabled")} on={auth} onChange={(on) => store.change("auth.enabled", on)} />
        </Row>
        <Row {...row("authUsername", "auth.username")} muted={!auth}>
          <TextInput label={t("set.authUsername")} disabled={!auth} value={v("auth.username")} onCommit={(s) => store.change("auth.username", s.trim())} />
        </Row>
        <Row {...row("authPassword", "auth.password")} muted={!auth}>
          <TextInput type="password" label={t("set.authPassword")} disabled={!auth} value={v<string | undefined>("auth.password") ?? ""} onCommit={(s) => store.change("auth.password", s)} />
        </Row>
      </Group>
      {(staged || exposed) && (
        <div className="flex w-full shrink-0 flex-col gap-[10px] rounded-[11px] border border-ui-border-strong bg-ui-surface px-[15px] py-[13px]">
          {exposed && (
            <p role="alert" className="flex items-start gap-[8px] text-[11.5px] leading-[17px] text-ui-amber">
              <AlertTriangle size={14} className="mt-[2px] shrink-0" />
              {t("set.exposed")}
            </p>
          )}
          {store.stagedError && <p className="break-all text-[11.5px] text-ui-red">{store.stagedError}</p>}
          {staged && (
            <div className="flex items-center gap-[10px]">
              <span className="flex-1 text-[11.5px] text-ui-text-2">{t("set.applyPending", { n: Object.keys(store.exposure).length })}</span>
              <Button onClick={store.discard}>{t("set.discard")}</Button>
              <Button tone="primary" disabled={busy} onClick={() => void apply()}>
                {t("set.apply")}
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export function NotificationsSection({ store, row }: SectionProps) {
  const { t } = useUi();
  const v = store.value;
  const on = v<boolean>("preferences.notifications.enabled");
  const toggle = (key: string, id: string, muted = false) => (
    <Row {...row(id, `preferences.notifications.${key}`)} muted={muted}>
      <Toggle label={t(`set.${id}`)} disabled={muted} on={v(`preferences.notifications.${key}`)} onChange={(next) => store.change(`preferences.notifications.${key}`, next)} />
    </Row>
  );
  return (
    <Group title={t("set.group.notifications")}>
      {toggle("enabled", "notifyEnabled")}
      {toggle("onComplete", "notifyComplete", !on)}
      {toggle("onAdd", "notifyAdd", !on)}
      {toggle("sound", "notifySound", !on)}
    </Group>
  );
}

const MODES: Mode[] = ["system", "light", "dark"];
const ACCENTS: Accent[] = ["green", "cyan", "amber", "violet"];

export function AppearanceSection({ store, row }: SectionProps) {
  const { t } = useUi();
  const v = store.value;
  const appearance = v<{ mode: Mode; accent: Accent }>("preferences.appearance");
  return (
    <>
      <Group title={t("set.group.theme")}>
        <Row {...row("mode", "preferences.appearance")}>
          <div className="inline-flex rounded-[9px] border border-ui-border bg-ui-surface-2 p-[3px]" role="radiogroup" aria-label={t("set.mode")}>
            {MODES.map((mode) => (
              <button
                key={mode}
                role="radio"
                aria-checked={appearance.mode === mode}
                onClick={() => store.change("preferences.appearance", { ...appearance, mode })}
                className={`rounded-[7px] px-[12px] py-[5px] text-[11.5px] ${appearance.mode === mode ? "bg-ui-surface text-ui-text shadow-sm" : "text-ui-text-2 hover:text-ui-text"}`}
              >
                {t(`appearance.mode.${mode}`)}
              </button>
            ))}
          </div>
        </Row>
        <Row {...row("accent", "preferences.appearance")}>
          <div className="flex gap-[6px]" role="radiogroup" aria-label={t("set.accent")}>
            {ACCENTS.map((accent) => (
              <button
                key={accent}
                role="radio"
                aria-checked={appearance.accent === accent}
                data-accent={accent}
                title={t(`appearance.accent.${accent}`)}
                onClick={() => store.change("preferences.appearance", { ...appearance, accent })}
                className={`flex items-center gap-[6px] rounded-[8px] border px-[8px] py-[5px] text-[11.5px] ${appearance.accent === accent ? "border-ui-accent bg-ui-accent-soft text-ui-text" : "border-ui-border text-ui-text-2 hover:text-ui-text"}`}
              >
                <span className="h-[10px] w-[10px] rounded-full bg-ui-accent" />
                {t(`appearance.accent.${accent}`)}
              </button>
            ))}
          </div>
        </Row>
      </Group>
      <Group title={t("set.group.display")}>
        <Row {...row("speedGraph", "preferences.showSpeedGraph")}>
          <Toggle label={t("set.speedGraph")} on={v("preferences.showSpeedGraph")} onChange={(on) => store.change("preferences.showSpeedGraph", on)} />
        </Row>
        <Row {...row("pieceMap", "preferences.showPieceMap")}>
          <Toggle label={t("set.pieceMap")} on={v("preferences.showPieceMap")} onChange={(on) => store.change("preferences.showPieceMap", on)} />
        </Row>
        <Row {...row("dateFormat", "preferences.dateFormat")}>
          <Select<DateFormat>
            label={t("set.dateFormat")}
            width="w-[220px]"
            value={v("preferences.dateFormat")}
            onChange={(next) => store.change("preferences.dateFormat", next)}
            options={(["relative", "absolute", "iso"] as const).map((value) => ({ value, label: t(`set.dateFormat.${value}`) }))}
          />
        </Row>
      </Group>
    </>
  );
}

export function AboutSection({ row, version, checkUpdates }: SectionProps & { version: string | undefined; checkUpdates: () => Promise<Release | null> }) {
  const { t } = useUi();
  const [status, setStatus] = useState<string | null>(null);
  const check = async () => {
    setStatus(t("set.checkNow.checking"));
    try {
      const r = await checkUpdates();
      setStatus(r && version && isNewer(r.version, version) ? t("update.available", { version: r.version }) : t("set.checkNow.latest", { version: version ?? "?" }));
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    }
  };
  return (
    <Group title={t("set.group.about")}>
      <Row {...row("version")}>
        <Chip tone="neutral">{version ?? "?"}</Chip>
      </Row>
      <Row {...row("checkNow")} desc={status ?? undefined}>
        <Button onClick={() => void check()}>{t("set.checkNow")}</Button>
      </Row>
    </Group>
  );
}
