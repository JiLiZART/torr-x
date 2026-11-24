import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, Calendar, Clock, Download, FileText, Globe, HardDrive, Hash, MessageSquare, Share2, Trash, Upload, User, Users } from "lucide-react";
import type { Torrent } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import { useDetails } from "../../lib/hooks";
import { bytes, eta, percent, pieceCells, rate } from "../../lib/format";
import { SECTIONS, type Section } from "../../lib/detail";
import type { TorrentAction } from "../../lib/commands";
import { Hero } from "./Hero";
import { FilesSection } from "./FilesSection";
import { PeersSection, TrackersSection, WebSeedsSection } from "./SwarmSections";

interface DetailPageProps {
  id: string;
  section: Section;
  onSection: (section: Section) => void;
  onAction: (torrent: Torrent, action: TorrentAction) => void;
  onError: (e: unknown) => void;
  onPollError: (e: unknown) => void;
  onNotice: (message: string) => void;
}

const HISTORY = 44;

function Item({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-[10px] py-[6px]">
      <span className="mt-[2px] text-ui-text-3">{icon}</span>
      <span className="min-w-0">
        <span className="block font-code text-[9px] uppercase tracking-[1px] text-ui-text-3">{label}</span>
        <span className="block break-all text-[12px] text-ui-text">{value}</span>
      </span>
    </div>
  );
}

/** A torrent as a page: hero, then one section at a time, each with its own address and lens. */
export function DetailPage({ id, section, onSection, onAction, onError, onPollError, onNotice }: DetailPageProps) {
  const { t, gate, date } = useUi();
  const want = { peers: section === "peers" && !gate("peerList"), pieces: section === "pieces" && !gate("pieces") };
  const { details, peers, pieces } = useDetails(id, want, { onError: onPollError });
  const d = details.data;
  const [history, setHistory] = useState<{ id: string; down: number[] }>({ id, down: [] });
  // The section lens: in memory, per torrent + section, gone when the section changes.
  const [lens, setLens] = useState({ key: `${id}:${section}`, query: "" });
  const key = `${id}:${section}`;
  const query = lens.key === key ? lens.query : "";
  const setQuery = (q: string) => setLens({ key, query: q });

  useEffect(() => {
    if (!d) return;
    setHistory((h) => ({ id: d.id, down: [...(h.id === d.id ? h.down : []), d.downloadRate].slice(-HISTORY) }));
  }, [d]);

  const counts: Partial<Record<Section, number>> = useMemo(
    () => (d ? { files: d.files.length, peers: d.peers + d.seeds, trackers: d.trackers.length, webseeds: d.webSeeds.length } : {}),
    [d],
  );

  if (!d) {
    return <div className="flex flex-1 items-center justify-center font-code text-[11px] text-ui-text-3">{details.error ? details.error.message : t("detail.loading")}</div>;
  }
  const reload = () => void details.reload();
  const cells = pieces.data ? pieceCells(pieces.data.bitfield, pieces.data.count, 2400) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Hero d={d} history={history.down} onAction={(action) => onAction(d, action)} />
      <nav className="sticky top-0 z-10 flex shrink-0 items-center gap-[4px] border-b border-ui-border bg-ui-chrome px-[14px] pt-[9px]" aria-label={t("detail.sections")}>
        {SECTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onSection(s)}
            aria-current={s === section ? "page" : undefined}
            className={`flex items-center gap-[6px] rounded-t-[8px] border-b-2 px-[11px] py-[8px] text-[12px] ${s === section ? "border-ui-accent bg-ui-surface font-semibold text-ui-text" : "border-transparent text-ui-text-2 hover:text-ui-text"}`}
          >
            {t(`detail.section.${s}`)}
            {counts[s] !== undefined && <span className={`font-code text-[10px] ${s === section ? "text-ui-accent" : "text-ui-text-3"}`}>{counts[s]}</span>}
          </button>
        ))}
        <span className="flex-1" />
        <span className="hidden pb-[8px] font-code text-[9px] text-ui-text-3 xl:block">{t("detail.sectionNote")}</span>
      </nav>
      <div className="flex flex-col bg-ui-surface">
        {section === "files" && <FilesSection d={d} query={query} onQuery={setQuery} onError={onError} onNotice={onNotice} />}
        {section === "peers" && <PeersSection d={d} query={query} onQuery={setQuery} peers={peers.data} error={peers.error?.message ?? null} />}
        {section === "trackers" && <TrackersSection d={d} query={query} onQuery={setQuery} onError={onError} onReload={reload} />}
        {section === "webseeds" && <WebSeedsSection d={d} query={query} onQuery={setQuery} onReload={reload} />}
        {section === "pieces" && (
          <div className="px-[22px] py-[16px]">
            {gate("pieces") ? (
              <p className="font-code text-[11px] text-ui-text-3">{gate("pieces")}</p>
            ) : !cells ? (
              <p className="font-code text-[11px] text-ui-text-3">{t("detail.loading")}</p>
            ) : (
              <>
                <p className="pb-[10px] font-code text-[10px] text-ui-text-3">{t("detail.piecesSummary", { n: pieces.data!.count, size: bytes(d.pieceSize ?? 0) })}</p>
                <div className="flex flex-wrap gap-[2px]">
                  {cells.map((c, i) => (
                    <span key={i} className={`h-[8px] w-[8px] rounded-[2px] ${c === "have" ? "bg-ui-accent" : c === "partial" ? "bg-ui-cyan" : "bg-ui-surface-3"}`} />
                  ))}
                </div>
                <div className="flex gap-[16px] pt-[10px] font-code text-[10px] text-ui-text-2">
                  {(["have", "partial", "missing"] as const).map((c) => (
                    <span key={c} className="flex items-center gap-[6px]">
                      <span className={`h-[8px] w-[8px] rounded-[2px] ${c === "have" ? "bg-ui-accent" : c === "partial" ? "bg-ui-cyan" : "bg-ui-surface-3"}`} />
                      {t(`details.piece.${c}`)}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {section === "overview" && (
          <div className="grid grid-cols-1 gap-x-[28px] px-[22px] py-[14px] md:grid-cols-2">
            <div>
              <Item icon={<Activity size={13} />} label={t("details.status")} value={d.error ? `${t(`state.${d.status}`)}: ${d.error}` : t(`state.${d.status}`)} />
              <Item icon={<FileText size={13} />} label={t("details.totalSize")} value={`${bytes(d.size)} · ${t("detail.wantedSize", { size: bytes(d.wantedSize) })}`} />
              <Item icon={<Download size={13} />} label={t("details.downloaded")} value={`${bytes(d.downloaded)} (${percent(d.progress)})`} />
              <Item icon={<Upload size={13} />} label={t("details.uploaded")} value={bytes(d.uploaded)} />
              <Item icon={<Share2 size={13} />} label={t("details.ratio")} value={d.ratio == null ? "—" : d.ratio.toFixed(2)} />
              <Item icon={<Users size={13} />} label={t("details.seedsPeers")} value={`${d.seeds} / ${d.peers}`} />
              <Item icon={<Calendar size={13} />} label={t("details.added")} value={date(d.addedAt)} />
              <Item icon={<User size={13} />} label={t("details.createdBy")} value={d.createdBy ?? "—"} />
              <Item icon={<Calendar size={13} />} label={t("details.createdAt")} value={date(d.createdAt)} />
              <Item icon={<MessageSquare size={13} />} label={t("details.comment")} value={d.comment || "—"} />
            </div>
            <div>
              <Item icon={<HardDrive size={13} />} label={t("details.savePath")} value={d.savePath} />
              <Item icon={<Hash size={13} />} label={t("details.hash")} value={d.id} />
              <Item icon={<Clock size={13} />} label={t("details.eta")} value={d.status === "paused" ? t("state.paused") : eta(d)} />
              <Item icon={<Download size={13} />} label={t("details.downloadSpeed")} value={rate(d.downloadRate).trim()} />
              <Item icon={<Upload size={13} />} label={t("details.uploadSpeed")} value={rate(d.uploadRate).trim()} />
              <Item icon={<FileText size={13} />} label={t("details.piecesInfo")} value={d.pieces && d.pieceSize ? `${d.pieces} × ${bytes(d.pieceSize)}` : "—"} />
              <Item icon={<Users size={13} />} label={t("details.availability")} value={d.availability == null ? "—" : d.availability.toFixed(2)} />
              <Item icon={<Trash size={13} />} label={t("details.wasted")} value={d.wasted == null ? "—" : bytes(d.wasted)} />
              <Item icon={<Globe size={13} />} label={t("details.tracker")} value={d.trackers.find((x) => x.kind === "tracker")?.url ?? "—"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
