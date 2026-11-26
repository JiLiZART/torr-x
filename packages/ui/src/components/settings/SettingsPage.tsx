// Settings as a page: section rail, auto-saving rows, staged engine restarts, search in the top bar.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Bell,
  Brush,
  Cpu,
  Folder,
  Gauge,
  Info,
  Link2,
  ListOrdered,
  Search,
  Settings as Cog,
  Shield,
  TableProperties,
  Wifi,
} from "lucide-react";
import type { EngineKind, Settings } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import type { LeaveGuard } from "../../lib/route";
import { deepLink, PATH_ROW, searchRows, SETTINGS_SECTIONS, type RowHit, type SettingsSection } from "../../lib/settings";
import type { Release } from "../../lib/updates";
import { KeyCaps } from "../KeyCaps";
import { Modal } from "../Modal";
import { NetworkSection } from "./NetworkSection";
import { Button } from "./rows";
import {
  AboutSection,
  AppearanceSection,
  BandwidthSection,
  EngineSection,
  FoldersSection,
  GeneralSection,
  NotificationsSection,
  QueueSection,
  SecuritySection,
  TabsSection,
  type SectionProps,
} from "./sections";
import { useSettingsStore } from "./useSettingsStore";

const ICONS: Record<SettingsSection, ReactNode> = {
  general: <Cog size={14} />,
  engine: <Cpu size={14} />,
  network: <Wifi size={14} />,
  bandwidth: <Gauge size={14} />,
  queue: <ListOrdered size={14} />,
  folders: <Folder size={14} />,
  tabs: <TableProperties size={14} />,
  security: <Shield size={14} />,
  notifications: <Bell size={14} />,
  appearance: <Brush size={14} />,
  about: <Info size={14} />,
};

const FOCUS_MS = 1600;

interface SettingsPageProps {
  section: SettingsSection;
  onSection: (section: SettingsSection) => void;
  /** Row to scroll to and highlight (a search hit), cleared through `onFocused`. */
  focusRow: string | null;
  onFocused: () => void;
  setLeaveGuard: (guard: LeaveGuard | null) => void;
  onSaved: (settings: Settings) => void;
  onError: (e: unknown) => void;
  onNotice: (text: string) => void;
  engineError: string | null;
  dhtNodes: number | null;
  grammarVersion: number | null;
  tabCount: number;
  version: string | undefined;
  checkUpdates: () => Promise<Release | null>;
}

export function SettingsPage(props: SettingsPageProps) {
  const { section, onSection, focusRow, onFocused, setLeaveGuard, onError, onNotice } = props;
  const { t, caps } = useUi();
  const engine: EngineKind = caps?.engine ?? "rqbit";
  const store = useSettingsStore(engine, props.onSaved, onError);
  const staged = Object.keys(store.restart).length + Object.keys(store.exposure).length;
  const [later, setLater] = useState(false);
  const [leaving, setLeaving] = useState<(() => void) | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const body = useRef<HTMLDivElement>(null);

  // A new staged change brings the notice back after "Later".
  const restartKeys = Object.keys(store.restart).join();
  useEffect(() => setLater(false), [restartKeys]);

  const stagedRef = useRef(staged);
  stagedRef.current = staged;
  useEffect(() => {
    setLeaveGuard((proceed) => {
      if (stagedRef.current === 0) return true;
      setLeaving(() => proceed);
      return false;
    });
    return () => setLeaveGuard(null);
  }, [setLeaveGuard]);

  useEffect(() => {
    if (!focusRow) return;
    const el = body.current?.querySelector(`[data-row="${focusRow}"]`);
    el?.scrollIntoView({ block: "center" });
    if (!el) return;
    setLit(focusRow);
    onFocused();
  }, [focusRow, section, store.saved, onFocused]);
  useEffect(() => {
    if (!lit) return;
    const timer = setTimeout(() => setLit(null), FOCUS_MS);
    return () => clearTimeout(timer);
  }, [lit]);

  const row: SectionProps["row"] = useCallback(
    (id, path) => ({ id, status: path ? store.status[path] : undefined, focused: lit === id }),
    [store.status, lit],
  );

  const applyExposure = store.applyExposure;
  const shared: SectionProps = {
    store: {
      ...store,
      // A restartRequired answer (bind/port) needs the server restarted by hand: say so where the user is.
      applyExposure: async () => {
        const res = await applyExposure();
        if (res?.restartRequired) onNotice(t("set.restartServer"));
        return res;
      },
    },
    row,
    onError,
  };

  const content = !store.saved ? null : (
    <>
      {section === "general" && <GeneralSection {...shared} />}
      {section === "engine" && <EngineSection {...shared} engineError={props.engineError} />}
      {section === "network" && <NetworkSection {...shared} dhtNodes={props.dhtNodes} />}
      {section === "bandwidth" && <BandwidthSection {...shared} />}
      {section === "queue" && <QueueSection {...shared} />}
      {section === "folders" && <FoldersSection {...shared} />}
      {section === "tabs" && <TabsSection {...shared} grammarVersion={props.grammarVersion} tabCount={props.tabCount} />}
      {section === "security" && <SecuritySection {...shared} />}
      {section === "notifications" && <NotificationsSection {...shared} />}
      {section === "appearance" && <AppearanceSection {...shared} />}
      {section === "about" && <AboutSection {...shared} version={props.version} checkUpdates={props.checkUpdates} />}
    </>
  );

  return (
    <div className="flex min-h-0 flex-1">
      <nav className="flex w-[214px] shrink-0 flex-col gap-[2px] overflow-y-auto border-r border-ui-border bg-ui-chrome px-[10px] py-[12px]" aria-label={t("set.title")}>
        {SETTINGS_SECTIONS.map((id) => (
          <button
            key={id}
            onClick={() => onSection(id)}
            aria-current={id === section ? "page" : undefined}
            className={`flex w-full items-center gap-[9px] rounded-[8px] border px-[10px] py-[8px] text-left text-[12.5px] ${id === section ? "border-ui-border bg-ui-surface font-semibold text-ui-text" : "border-transparent text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text"}`}
          >
            <span className={id === section ? "text-ui-accent" : "text-ui-text-3"}>{ICONS[id]}</span>
            {t(`set.section.${id}`)}
          </button>
        ))}
        <span className="flex-1" />
        <div className="mt-[10px] flex flex-col gap-[5px] rounded-[9px] border border-ui-border bg-ui-surface-2 p-[11px]">
          <span className="font-code text-[9px] tracking-[1.2px] text-ui-text-3">{t("set.engineBadge")}</span>
          <span className="break-all font-code text-[10px] text-ui-accent">
            {[caps?.engine, caps?.version].filter(Boolean).join(" ")} · {engine === "transmission" ? t("set.engine.remoteShort") : t("set.engine.embedded")}
          </span>
          <span className="font-code text-[9px] leading-[13px] text-ui-text-3">{t("set.engine.capsNote")}</span>
        </div>
      </nav>
      <div ref={body} className="flex min-w-0 flex-1 flex-col gap-[14px] overflow-y-auto px-[26px] py-[16px]">
        {Object.keys(store.restart).length > 0 && !later && (
          <RestartBanner
            changes={store.restart}
            saved={store.saved}
            error={store.stagedError}
            onLater={() => setLater(true)}
            onRestart={store.restartEngine}
          />
        )}
        {content}
        <p className="flex flex-wrap items-center gap-[6px] font-code text-[10px] leading-[15px] text-ui-text-3">
          {t("set.footer")}
          <button
            className="flex items-center gap-[4px] rounded-[5px] border border-ui-border px-[6px] py-[2px] text-ui-text-2 hover:text-ui-text"
            title={t("set.copyLink")}
            onClick={() => void navigator.clipboard?.writeText(deepLink(section)).then(() => onNotice(t("set.linkCopied", { link: deepLink(section) })))}
          >
            <Link2 size={10} /> {deepLink(section)}
          </button>
        </p>
      </div>
      {leaving && (
        <Modal
          title={
            <>
              <AlertTriangle size={16} className="mr-2 text-ui-amber" /> {t("set.leave.title")}
            </>
          }
          onClose={() => setLeaving(null)}
          footer={
            <>
              <Button onClick={() => setLeaving(null)}>{t("set.leave.stay")}</Button>
              <Button
                tone="primary"
                onClick={() => {
                  const proceed = leaving;
                  stagedRef.current = 0;
                  store.discard();
                  setLeaving(null);
                  proceed();
                }}
              >
                {t("set.leave.discard")}
              </Button>
            </>
          }
        >
          <p className="text-[12px] text-ui-text-2">{t("set.leave.body", { n: staged })}</p>
        </Modal>
      )}
    </div>
  );
}

function RestartBanner({ changes, saved, error, onLater, onRestart }: { changes: Record<string, unknown>; saved: Settings | null; error: string | null; onLater: () => void; onRestart: () => Promise<boolean> }) {
  const { t } = useUi();
  const [busy, setBusy] = useState(false);
  const show = (path: string, value: unknown) =>
    path.endsWith("password") ? "••••" : typeof value === "boolean" ? (value ? t("set.on") : t("set.off")) : value === "" ? "—" : String(value);
  const lines = Object.entries(changes).map(([path, to]) => {
    const from = saved ? path.split(".").reduce<unknown>((at, k) => (at as Record<string, unknown>)?.[k], saved) : undefined;
    return t("set.restart.change", { name: t(`set.${PATH_ROW[path] ?? path}`), from: show(path, from), to: show(path, to) });
  });
  const onlyPort = Object.keys(changes).length === 1 && "network.listenPort" in changes;
  return (
    <div role="status" className="flex w-full shrink-0 items-center gap-[11px] rounded-[11px] border border-ui-amber bg-ui-amber-soft px-[15px] py-[13px]">
      <AlertTriangle size={15} className="shrink-0 text-ui-amber" />
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className="text-[12.5px] font-semibold text-ui-amber">{t("set.restart.title")}</span>
        <span className="text-[11.5px] leading-[17px] text-ui-text-2">
          {lines.join(" ")} {t(onlyPort ? "set.restart.tailPort" : "set.restart.tail")}
        </span>
        {error && <span className="break-all text-[11px] text-ui-red">{error}</span>}
      </div>
      <button onClick={onLater} className="shrink-0 rounded-[8px] border border-ui-amber px-[12px] py-[8px] text-[12px] font-medium text-ui-amber">
        {t("set.restart.later")}
      </button>
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await onRestart();
          setBusy(false);
        }}
        className="shrink-0 rounded-[8px] bg-ui-amber px-[13px] py-[8px] text-[12px] font-semibold text-ui-bg disabled:opacity-50"
      >
        {t("set.restart.now")}
      </button>
    </div>
  );
}

/** "Search settings ⌘F": rows across every section; choosing one opens its section at that row. */
export function SettingsSearch({ onPick }: { onPick: (hit: RowHit) => void }) {
  const { t } = useUi();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const hits = useMemo(
    () =>
      searchRows(query, (row) => ({
        title: t(`set.${row.id}`, { types: "HTTP / SOCKS4" }),
        desc: t(`set.${row.id}.desc`, { engine: "", age: "" }),
        section: t(`set.section.${row.section}`),
      })).slice(0, 8),
    [query, t],
  );
  useEffect(() => {
    // Page-local, like the palette's keys: only while the settings page is open.
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        input.current?.focus();
        input.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const pick = (hit: RowHit | undefined) => {
    if (!hit) return;
    onPick(hit);
    setQuery("");
    input.current?.blur();
  };
  return (
    <div className="relative w-[230px] shrink-0">
      <label className="flex items-center gap-[7px] rounded-[8px] border border-ui-border bg-ui-surface-2 px-[10px] py-[7px] focus-within:border-ui-accent">
        <Search size={13} className="shrink-0 text-ui-text-3" />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") setCursor((c) => Math.min(c + 1, hits.length - 1));
            else if (e.key === "ArrowUp") setCursor((c) => Math.max(c - 1, 0));
            else if (e.key === "Enter") pick(hits[cursor]);
            else if (e.key === "Escape") {
              setQuery("");
              e.currentTarget.blur();
            } else return;
            e.preventDefault();
          }}
          placeholder={t("set.search")}
          aria-label={t("set.search")}
          className="min-w-0 flex-1 bg-transparent text-[12px] text-ui-text placeholder:text-ui-text-3 focus:outline-none"
        />
        {!query && <KeyCaps binding="Mod+F" tone="text-ui-text-3" />}
      </label>
      {query.trim() && (
        <ul role="listbox" className="absolute right-0 top-[calc(100%+6px)] z-40 w-[340px] overflow-hidden rounded-[10px] border border-ui-border-strong bg-ui-surface py-[4px] shadow-lg">
          {hits.length === 0 && <li className="px-[12px] py-[8px] text-[12px] text-ui-text-3">{t("set.search.none")}</li>}
          {hits.map((hit, i) => (
            <li key={hit.id} role="option" aria-selected={i === cursor}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(hit)}
                onMouseEnter={() => setCursor(i)}
                className={`flex w-full items-center gap-[10px] px-[12px] py-[7px] text-left ${i === cursor ? "bg-ui-surface-2" : ""}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] text-ui-text">{hit.title}</span>
                  <span className="block truncate text-[10.5px] text-ui-text-3">{hit.desc}</span>
                </span>
                <span className="shrink-0 font-code text-[10px] text-ui-text-3">{t(`set.section.${hit.section}`)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

