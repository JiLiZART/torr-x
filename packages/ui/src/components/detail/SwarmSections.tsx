import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { api, type Peer, type TorrentDetails } from "@torrentx/api-client";
import { compare, evaluate, parse, PEER_SCOPE, sortKeys, TRACKER_SCOPE, WEBSEED_SCOPE, type Scope } from "@torrentx/query";
import { useUi } from "../../lib/context";
import { bytes, duration, rate } from "../../lib/format";
import { clickSort } from "../../lib/lens";
import { peerRow, trackerRow, webSeedRow, type TrackerStatusWord } from "../../lib/detail";
import { MiniFilterBar } from "./MiniFilterBar";
import { MiniBar, SectionEmpty, TableHeader, type Column } from "./Table";

interface SectionProps {
  d: TorrentDetails;
  query: string;
  onQuery: (query: string) => void;
  onError: (e: unknown) => void;
}

/** Rows the section lens lets through, in the lens's order. */
function useLens<R extends object>(rows: R[], query: string, scope: Scope) {
  const ast = parse(query, scope).ast;
  // No sort chip: the engine's order (tracker tiers, connection order) stays.
  const shown = useMemo(() => {
    if (!ast) return rows;
    const kept = rows.filter((r) => evaluate(ast, r));
    return sortKeys(ast).length > 0 ? kept.sort(compare(sortKeys(ast), scope)) : kept;
  }, [rows, ast, scope]);
  return { shown, sort: ast ? sortKeys(ast)[0] : undefined };
}

const dash = <span className="text-ui-text-3">—</span>;
const num = (v: number | null) => (v === null ? dash : v);

/** `42s ago` / `in 18m` from unix seconds. */
function relative(secs: number | null, t: (k: string, v?: Record<string, string | number>) => string) {
  if (secs === null) return dash;
  const diff = Math.round(secs - Date.now() / 1000);
  if (Math.abs(diff) < 5) return t("detail.now");
  return diff < 0 ? t("detail.ago", { d: duration(-diff) }) : t("detail.in", { d: duration(diff) });
}

// ---- Peers ---------------------------------------------------------------------------------------

const LEGEND = ["D", "U", "I", "E", "K", "S", "?"];

export function PeersSection({ d, query, onQuery, peers, error }: Omit<SectionProps, "onError"> & { peers: Peer[] | null; error: string | null }) {
  const { t, gate, prefs, compact } = useUi();
  const rows = useMemo(() => (peers ?? []).map(peerRow), [peers]);
  const { shown, sort } = useLens(rows, query, PEER_SCOPE);
  const names = useMemo(() => {
    try {
      return new Intl.DisplayNames([prefs.language], { type: "region" });
    } catch {
      return null;
    }
  }, [prefs.language]);
  const hint = gate("peerList");
  const columns: Column[] = [
    { field: "address", label: t("detail.col.address"), className: "w-[170px] shrink-0 text-left" },
    { field: "country", label: t("detail.col.country"), className: "w-[140px] shrink-0 text-left" },
    { field: "client", label: t("detail.col.client"), className: "min-w-0 flex-1 text-left" },
    { field: "progress", label: t("detail.col.progress"), className: "w-[120px] shrink-0 text-left" },
    { field: "down", label: t("detail.col.down"), className: "w-[90px] shrink-0 text-right" },
    { field: "up", label: t("detail.col.up"), className: "w-[90px] shrink-0 text-right" },
    { field: "flags", label: t("detail.col.flags"), className: "w-[110px] shrink-0 text-left" },
    { label: t("detail.col.enc"), className: "w-[44px] shrink-0 text-left" },
  ];
  return (
    <>
      <MiniFilterBar
        scope={PEER_SCOPE}
        query={query}
        onQuery={onQuery}
        placeholder={t("detail.filterPeers")}
        count={t("detail.count.peers", { n: shown.length, m: rows.length })}
        values={{ country: [...new Set(rows.flatMap((r) => (r.country ? [r.country.toLowerCase()] : [])))].sort() }}
      />
      <TableHeader columns={columns} sort={sort} onSort={(field) => onQuery(clickSort(query, [], field, PEER_SCOPE))} />
      <div className="flex flex-col gap-[1px] px-[14px] py-[8px]">
        {hint ? (
          <SectionEmpty>{hint}</SectionEmpty>
        ) : error ? (
          <SectionEmpty>{error}</SectionEmpty>
        ) : peers === null ? (
          <SectionEmpty>{t("detail.loading")}</SectionEmpty>
        ) : shown.length === 0 ? (
          <SectionEmpty>{rows.length === 0 ? t(d.status === "paused" ? "detail.empty.peersPaused" : "detail.empty.peers") : t("detail.empty.lens")}</SectionEmpty>
        ) : (
          shown.map((p) => (
            <div key={p.address} className={`flex items-center gap-[10px] rounded-[8px] px-[8px] ${compact ? "py-[2px]" : "py-[7px]"} font-code text-[11px] hover:bg-ui-surface-2`}>
              <span className="w-[170px] shrink-0 truncate text-ui-text" title={p.address}>
                {p.address}
              </span>
              <span className="flex w-[140px] shrink-0 items-center gap-[6px]">
                {p.country ? (
                  <>
                    <span className="rounded-[4px] bg-ui-surface-3 px-[5px] py-[1px] text-[10px] text-ui-text">{p.country}</span>
                    <span className="truncate text-ui-text-3">{names?.of(p.country) ?? ""}</span>
                  </>
                ) : (
                  dash
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-ui-text-2">{p.client ?? "—"}</span>
              <span className="w-[120px] shrink-0">{p.progress === null ? dash : <MiniBar value={p.progress} tone="bg-ui-cyan" />}</span>
              <span className="w-[90px] shrink-0 text-right text-ui-text">{p.down > 0 ? rate(p.down).trim() : dash}</span>
              <span className="w-[90px] shrink-0 text-right text-ui-text-2">{p.up > 0 ? rate(p.up).trim() : dash}</span>
              <span className="flex w-[110px] shrink-0 flex-wrap gap-[3px]">
                {p.letters.length === 0
                  ? dash
                  : p.letters.map((l, i) => (
                      <span key={i} title={t(`detail.flag.${l === "?" ? "unknown" : l}`)} className="rounded-[4px] border border-ui-border px-[4px] text-[10px] text-ui-text-2">
                        {l}
                      </span>
                    ))}
              </span>
              <span className="w-[44px] shrink-0 text-ui-text-3">{p.encryption ?? "—"}</span>
            </div>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-x-[14px] gap-y-[4px] border-t border-ui-border px-[22px] py-[10px] font-code text-[10px] text-ui-text-3">
        {LEGEND.map((l) => (
          <span key={l}>
            <span className="text-ui-text-2">{l}</span> {t(`detail.flag.${l === "?" ? "unknown" : l}`)}
          </span>
        ))}
      </div>
    </>
  );
}

// ---- Trackers + web seeds --------------------------------------------------------------------------

const STATUS_TONE: Record<TrackerStatusWord, string> = {
  working: "text-ui-accent",
  updating: "text-ui-cyan",
  "not working": "text-ui-red",
  disabled: "text-ui-text-3",
  unknown: "text-ui-text-3",
};

function AddUrl({ label, hint, onAdd }: { label: string; hint?: string; onAdd: (url: string) => Promise<void> }) {
  const { t } = useUi();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!url?.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(url.trim());
      setUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };
  if (url === null) {
    return (
      <button disabled={!!hint} title={hint} onClick={() => setUrl("")} className="flex items-center gap-[5px] rounded-[8px] border border-ui-border-strong px-[9px] py-[5px] text-[11px] text-ui-text-2 hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-40">
        <Plus size={12} /> {label}
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="flex items-center gap-[6px]">
      <input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setUrl(null)} placeholder="https://…" aria-label={label} className="w-[260px] rounded-[8px] border border-ui-accent-line bg-ui-surface-2 px-[9px] py-[5px] font-code text-[11px] text-ui-text focus:outline-none" />
      <button type="submit" disabled={busy} className="rounded-[8px] bg-ui-accent px-[10px] py-[5px] text-[11px] font-semibold text-ui-bg disabled:opacity-50">
        {t("detail.add")}
      </button>
      {error && <span className="max-w-[240px] truncate text-[11px] text-ui-red" title={error}>{error}</span>}
    </form>
  );
}

function Heading({ title, summary, children }: { title: string; summary: string; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-[10px] px-[22px] pb-[6px] pt-[14px]">
      <span className="text-[13px] font-semibold text-ui-text">{title}</span>
      <span className="font-code text-[10px] text-ui-text-3">{summary}</span>
      <span className="flex-1" />
      {children}
    </div>
  );
}

export function TrackersSection({ d, query, onQuery, onError, onReload }: SectionProps & { onReload: () => void }) {
  const { t, gate, compact } = useUi();
  const rows = useMemo(() => d.trackers.map(trackerRow), [d.trackers]);
  const { shown, sort } = useLens(rows, query, TRACKER_SCOPE);
  const announced = rows.filter((r) => r.kind === "tracker").length;
  const failing = rows.filter((r) => r.status === "not working").length;
  const reannounceHint = gate("reannounce");
  const reannounce = () => api.reannounce(d.id).then(onReload, onError);
  const columns: Column[] = [
    { field: "url", label: t("detail.col.trackerUrl"), className: "min-w-0 flex-1 text-left" },
    { field: "tier", label: t("detail.col.tier"), className: "w-[44px] shrink-0 text-right" },
    { field: "status", label: t("detail.col.status"), className: "w-[110px] shrink-0 text-left" },
    { field: "seeds", label: t("detail.col.seeds"), className: "w-[60px] shrink-0 text-right" },
    { field: "leechers", label: t("detail.col.leech"), className: "w-[60px] shrink-0 text-right" },
    { label: t("detail.col.downloaded"), className: "w-[90px] shrink-0 text-right" },
    { label: t("detail.col.last"), className: "w-[90px] shrink-0 text-right" },
    { label: t("detail.col.next"), className: "w-[80px] shrink-0 text-right" },
  ];
  return (
    <>
      <MiniFilterBar scope={TRACKER_SCOPE} query={query} onQuery={onQuery} placeholder={t("detail.filterTrackers")} count={t("detail.count.trackers", { n: shown.length, m: rows.length })}>
        <AddUrl label={t("detail.addTracker")} hint={gate("addTracker")} onAdd={(url) => api.addTracker(d.id, url).then(onReload)} />
      </MiniFilterBar>
      <Heading title={t("detail.section.trackers")} summary={t("detail.trackerSummary", { n: announced, f: failing })}>
        <button disabled={!!reannounceHint} title={reannounceHint} onClick={() => void reannounce()} className="flex items-center gap-[5px] rounded-[8px] border border-ui-border px-[9px] py-[5px] text-[11px] text-ui-text-2 hover:text-ui-text disabled:cursor-not-allowed disabled:opacity-40">
          <RefreshCw size={12} /> {t("detail.reannounceAll")}
        </button>
      </Heading>
      <TableHeader columns={columns} sort={sort} onSort={(field) => onQuery(clickSort(query, [], field, TRACKER_SCOPE))} />
      <div className="flex flex-col gap-[1px] px-[14px] py-[8px]">
        {shown.length === 0 && <SectionEmpty>{rows.length === 0 ? t("detail.empty.trackers") : t("detail.empty.lens")}</SectionEmpty>}
        {shown.map((r) => {
          const pseudo = r.kind !== "tracker";
          return (
            <div key={`${r.kind}:${r.url}`} className={`flex flex-col rounded-[8px] px-[8px] ${compact ? "py-[2px]" : "py-[7px]"} hover:bg-ui-surface-2`}>
              <div className="flex items-center gap-[10px] font-code text-[11px]">
                <span className={`min-w-0 flex-1 truncate ${pseudo ? "text-ui-text-2" : "text-ui-text"}`} title={r.url}>
                  {r.url}
                </span>
                <span className="w-[44px] shrink-0 text-right text-ui-text-2">{r.tier === null ? dash : r.tier}</span>
                <span className={`w-[110px] shrink-0 ${STATUS_TONE[r.status]}`}>{t(`detail.tracker.${r.status.replace(" ", "")}`)}</span>
                <span className="w-[60px] shrink-0 text-right text-ui-text-2">{num(r.seeds)}</span>
                <span className="w-[60px] shrink-0 text-right text-ui-text-2">{num(r.leechers)}</span>
                <span className="w-[90px] shrink-0 text-right text-ui-text-2">{r.tracker.downloaded === null ? dash : bytes(r.tracker.downloaded)}</span>
                <span className="w-[90px] shrink-0 text-right text-ui-text-3">{pseudo ? dash : relative(r.tracker.lastAnnounce, t)}</span>
                <span className="w-[80px] shrink-0 text-right text-ui-text-3">{pseudo ? dash : relative(r.tracker.nextAnnounce, t)}</span>
              </div>
              {r.tracker.error && (
                <div className="flex items-center gap-[8px] pt-[4px] font-code text-[10px] text-ui-red">
                  <TriangleAlert size={11} /> <span className="min-w-0 truncate" title={r.tracker.error}>{r.tracker.error}</span>
                  <button disabled={!!reannounceHint} title={reannounceHint} onClick={() => void reannounce()} className="text-ui-text-2 underline hover:text-ui-text disabled:no-underline disabled:opacity-40">
                    {t("detail.reannounce")}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

export function WebSeedsSection({ d, query, onQuery, onReload }: Omit<SectionProps, "onError"> & { onReload: () => void }) {
  const { t, gate, compact } = useUi();
  const rows = useMemo(() => d.webSeeds.map(webSeedRow), [d.webSeeds]);
  const { shown, sort } = useLens(rows, query, WEBSEED_SCOPE);
  const failing = rows.filter((r) => r.status === "failed").length;
  const reportHint = gate("webSeeds");
  const columns: Column[] = [
    { field: "url", label: t("detail.col.url"), className: "min-w-0 flex-1 text-left" },
    { field: "type", label: t("detail.col.type"), className: "w-[70px] shrink-0 text-left" },
    { field: "status", label: t("detail.col.status"), className: "w-[100px] shrink-0 text-left" },
    { field: "speed", label: t("detail.col.speed"), className: "w-[90px] shrink-0 text-right" },
    { label: t("detail.col.downloaded"), className: "w-[90px] shrink-0 text-right" },
  ];
  return (
    <>
      <MiniFilterBar scope={WEBSEED_SCOPE} query={query} onQuery={onQuery} placeholder={t("detail.filterWebSeeds")} count={t("detail.count.webSeeds", { n: shown.length, m: rows.length })}>
        <AddUrl label={t("detail.addWebSeed")} hint={gate("addWebSeed")} onAdd={(url) => api.addWebSeed(d.id, url).then(onReload)} />
      </MiniFilterBar>
      <Heading title={t("detail.section.webseeds")} summary={t("detail.webSeedSummary", { n: rows.length, f: failing })} />
      <TableHeader columns={columns} sort={sort} onSort={(field) => onQuery(clickSort(query, [], field, WEBSEED_SCOPE))} />
      <div className="flex flex-col gap-[1px] px-[14px] py-[8px]">
        {shown.length === 0 && <SectionEmpty>{reportHint ?? (rows.length === 0 ? t("detail.empty.webSeeds") : t("detail.empty.lens"))}</SectionEmpty>}
        {shown.map((r) => (
          <div key={r.url} className={`flex flex-col rounded-[8px] px-[8px] ${compact ? "py-[2px]" : "py-[7px]"} hover:bg-ui-surface-2`}>
            <div className="flex items-center gap-[10px] font-code text-[11px]">
              <span className="min-w-0 flex-1 truncate text-ui-text" title={r.url}>
                {r.url}
              </span>
              <span className="w-[70px] shrink-0 text-ui-text-2">{r.type === "bep19" ? "BEP 19" : "BEP 17"}</span>
              <span className={`w-[100px] shrink-0 ${r.status === "failed" ? "text-ui-red" : r.status ? "text-ui-accent" : "text-ui-text-3"}`}>{r.status ?? "—"}</span>
              <span className="w-[90px] shrink-0 text-right text-ui-text-2">{r.speed ? rate(r.speed).trim() : dash}</span>
              <span className="w-[90px] shrink-0 text-right text-ui-text-2">{r.seed.downloaded === null ? dash : bytes(r.seed.downloaded)}</span>
            </div>
            {r.seed.error && (
              <div className="flex items-center gap-[8px] pt-[4px] font-code text-[10px] text-ui-red">
                <TriangleAlert size={11} /> {r.seed.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
