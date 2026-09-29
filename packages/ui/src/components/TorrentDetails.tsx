import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  X,
  FileText,
  Calendar,
  Clock,
  HardDrive,
  Hash,
  Download,
  Upload,
  Users,
  Share2,
  Globe,
  Server,
  FileIcon,
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronRight,
  ChevronDown,
  FolderIcon,
  CheckCircle,
  XCircle,
  ArrowUp,
  ArrowDown,
  User,
  Activity,
  MessageSquare,
  Trash,
} from "lucide-react";
import { api, type FileInfo, type Peer, type Priority, type TorrentDetails as Details } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { useDetails } from "../lib/hooks";
import { bytes, eta, percent, pieceCells, rate, statusColor } from "../lib/format";
import { buildTree, folderPaths, type TreeNode } from "../lib/tree";
import { softButtonClass } from "./Modal";

interface TorrentDetailsProps {
  id: string;
  onClose: () => void;
  /** Action failures (shown to the user). */
  onError: (e: unknown) => void;
  /** Polling failures (only auth matters; the panel shows the rest inline). */
  onPollError: (e: unknown) => void;
}

type DetailTab = "general" | "trackers" | "peers" | "seeds" | "files";
const SAMPLES = 60;
const POLL_SECS = 1;

const th = "px-3 py-2 text-left text-xs font-medium text-tx-accent-700 uppercase tracking-wider";
const td = "px-3 py-2 whitespace-nowrap text-sm text-tx-accent-400";

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start space-x-3 py-2">
      <div className="text-tx-accent-600 mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-tx-accent-700 text-xs">{label}</div>
        <div className="text-tx-accent-400 text-sm break-all">{value}</div>
      </div>
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <>
      <div className="w-24 bg-tx-surface-800 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value * 100}%` }}></div>
      </div>
      <span className="text-xs text-tx-accent-400">{percent(value)}</span>
    </>
  );
}

function Graph({ down, up, d }: { down: number[]; up: number[]; d: Details }) {
  const { t } = useUi();
  const height = 60;
  const width = 300;
  const line = (values: number[]) => {
    const max = Math.max(...values, 1);
    const step = width / Math.max(values.length - 1, 1);
    return values.map((v, i) => `${i * step},${height - (v / max) * height}`).join(" ");
  };
  return (
    <div className="mt-4 p-4 border border-tx-accent-900/30 rounded-md bg-tx-base/50">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center">
          <ArrowDownCircle size={14} className="text-blue-500 mr-1" />
          <span className="text-blue-500 text-xs font-semibold">
            {t("details.graphDown", { rate: rate(d.downloadRate) })}
          </span>
        </div>
        <div className="flex items-center">
          <ArrowUpCircle size={14} className="text-tx-accent-500 mr-1" />
          <span className="text-tx-accent-500 text-xs font-semibold">
            {t("details.graphUp", { rate: rate(d.uploadRate) })}
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="w-full h-[60px]">
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            y1={(i * height) / 3}
            x2={width}
            y2={(i * height) / 3}
            stroke="rgb(var(--tx-surface-800))"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        ))}
        <polyline points={line(down)} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
        <polyline points={line(up)} fill="none" stroke="#10b981" strokeWidth="1.5" />
      </svg>
      <div className="flex justify-between text-xs text-tx-accent-700 mt-1">
        <span>{t("details.secondsAgo", { n: SAMPLES * POLL_SECS })}</span>
        <span>{t("details.now")}</span>
      </div>
    </div>
  );
}

function PieceMap({ bitfield, count }: { bitfield: string; count: number }) {
  const { t } = useUi();
  const cells = useMemo(() => pieceCells(bitfield, count), [bitfield, count]);
  const color = { have: "bg-tx-accent-500", partial: "bg-blue-500", missing: "bg-tx-surface-800" };
  return (
    <div className="mt-4">
      <h4 className="text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mb-2">
        {t("details.pieces")}
      </h4>
      <div className="border border-tx-accent-900/30 rounded-md p-3 bg-tx-base/20">
        <div className="max-h-[120px] w-full overflow-hidden relative">
          <div className="flex flex-wrap w-full h-full">
            {cells.map((c, i) => (
              <div key={i} className={`h-3 w-3 m-0.5 rounded-sm ${color[c]}`} />
            ))}
          </div>
        </div>
        <div className="flex justify-between mt-3 text-xs text-tx-accent-600">
          {(["have", "partial", "missing"] as const).map((c) => (
            <div key={c} className="flex items-center">
              <div className={`h-3 w-3 rounded-sm ${color[c]} mr-2`}></div>
              <span>{t(`details.piece.${c}`)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PeerTable({ peers, gateHint }: { peers: Peer[] | null; gateHint?: string }) {
  const { t } = useUi();
  if (gateHint) return <p className="mt-4 text-xs text-tx-accent-700">{gateHint}</p>;
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="min-w-full divide-y divide-tx-accent-900/30">
        <thead>
          <tr>
            {["address", "client", "country", "progress", "download", "upload", "flags"].map((c) => (
              <th key={c} className={th}>
                {t(`details.peer.${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-tx-accent-900/20">
          {(peers ?? []).map((p) => (
            <tr key={p.address} className="hover:bg-tx-accent-900/10">
              <td className={td}>{p.address}</td>
              <td className={td}>{p.client ?? "-"}</td>
              <td className={td}>{p.country ?? "-"}</td>
              <td className="px-3 py-2 whitespace-nowrap text-sm">
                {p.progress == null ? "-" : <Bar value={p.progress} color="bg-blue-600" />}
              </td>
              <td className={td}>{rate(p.downloadRate)}</td>
              <td className={td}>{rate(p.uploadRate)}</td>
              <td className={td}>{p.flags ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {peers?.length === 0 && <p className="mt-3 text-xs text-tx-accent-700">{t("details.noPeers")}</p>}
    </div>
  );
}

function priorityLabel(f: { wanted: boolean; priority: Priority }) {
  return f.wanted ? `details.priority.${f.priority}` : "details.priority.skip";
}

function FilesTab({ d, onError }: { d: Details; onError: (e: unknown) => void }) {
  const { t, gate } = useUi();
  const tree = useMemo(() => buildTree(d.files), [d.files]);
  const folders = useMemo(() => folderPaths(tree), [tree]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [hovered, setHovered] = useState<string | null>(null);
  const skipHint = gate("fileSkip");
  const prioHint = gate("filePriority");

  const set = (indices: number[], change: { wanted?: boolean; priority?: Priority }) =>
    api.setFiles(d.id, indices, change).catch(onError);
  const toggle = (path: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const byIndex = new Map(d.files.map((f) => [f.index, f]));
  const nodeState = (n: TreeNode<FileInfo>) => {
    if (n.file) return n.file;
    const fs = n.indices.map((i) => byIndex.get(i)!);
    const wanted = fs.some((f) => f.wanted);
    const first = fs.find((f) => f.wanted)?.priority ?? "normal";
    return { wanted, priority: fs.every((f) => !f.wanted || f.priority === first) ? first : ("normal" as Priority) };
  };

  const menuItem = (icon: ReactNode, label: string, onClick: () => void, hint?: string) => (
    <li title={hint}>
      <button
        disabled={!!hint}
        onClick={onClick}
        className="px-3 py-1.5 w-full text-left hover:bg-tx-accent-900/20 flex items-center text-tx-accent-400 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {icon}
        {label}
      </button>
    </li>
  );

  const render = (nodes: TreeNode<FileInfo>[], level = 0): ReactNode =>
    nodes.map((n) => {
      const isFolder = !n.file;
      const expanded = !collapsed.has(n.path);
      const st = nodeState(n);
      const progress = n.size > 0 ? n.done / n.size : 0;
      return (
        <Fragment key={(isFolder ? "d:" : "f:") + n.path}>
          <tr
            className="hover:bg-tx-accent-900/10"
            onMouseEnter={() => setHovered(n.path)}
            onMouseLeave={() => setHovered(null)}
          >
            <td className={td}>
              <div className="flex items-center" style={{ paddingLeft: `${level * 16}px` }}>
                {isFolder ? (
                  <button
                    className="mr-1 focus:outline-none text-tx-accent-600 hover:text-tx-accent-400"
                    onClick={() => toggle(n.path)}
                  >
                    {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <span className="ml-4"></span>
                )}
                <span className="mr-2">
                  {isFolder ? <FolderIcon size={14} className="text-yellow-500" /> : <FileIcon size={14} />}
                </span>
                <span className={st.wanted ? "" : "line-through opacity-60"}>{n.name}</span>
              </div>
            </td>
            <td className={td}>{bytes(n.size)}</td>
            <td className="px-3 py-2 whitespace-nowrap text-sm">
              <Bar value={progress} color="bg-green-600" />
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-sm relative">
              <span
                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${!st.wanted ? "bg-gray-800/60 text-gray-400" : st.priority === "high" ? "bg-blue-900/30 text-blue-400" : st.priority === "low" ? "bg-yellow-900/30 text-yellow-400" : "bg-tx-accent-900/30 text-tx-accent-400"}`}
              >
                {t(priorityLabel(st))}
              </span>
              {hovered === n.path && (
                <div
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-tx-surface-950 border border-tx-accent-900/30 rounded-md shadow-lg z-10"
                  style={{ minWidth: "140px" }}
                >
                  <ul className="py-1 text-xs">
                    {st.wanted
                      ? menuItem(<XCircle size={12} className="mr-2" />, t("details.skipFile"), () => set(n.indices, { wanted: false }), skipHint)
                      : menuItem(<CheckCircle size={12} className="mr-2" />, t("details.downloadFile"), () => set(n.indices, { wanted: true }), skipHint)}
                    <li className="border-t border-tx-accent-900/20 pt-1 mt-1"></li>
                    {menuItem(<ArrowUp size={12} className="mr-2" />, t("details.priorityHigh"), () => set(n.indices, { priority: "high" }), prioHint)}
                    {menuItem(<span className="ml-1 mr-3">-</span>, t("details.priorityNormal"), () => set(n.indices, { priority: "normal" }), prioHint)}
                    {menuItem(<ArrowDown size={12} className="mr-2" />, t("details.priorityLow"), () => set(n.indices, { priority: "low" }), prioHint)}
                  </ul>
                </div>
              )}
            </td>
          </tr>
          {isFolder && expanded && render(n.children, level + 1)}
        </Fragment>
      );
    });

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-tx-accent-900/30">
          <thead>
            <tr>
              {["name", "size", "progress", "priority"].map((c) => (
                <th key={c} className={th}>
                  {t(`details.file.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-tx-accent-900/20">{render(tree)}</tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-between">
        <div className="text-xs text-tx-accent-500">
          <span className="font-semibold">{t("details.totalFiles")}</span>{" "}
          {t("details.fileCount", { files: d.files.length, dirs: folders.length })}
        </div>
        <div className="flex space-x-2">
          <button className={softButtonClass} onClick={() => setCollapsed(new Set())}>
            {t("details.expandAll")}
          </button>
          <button className={softButtonClass} onClick={() => setCollapsed(new Set(folders))}>
            {t("details.collapseAll")}
          </button>
        </div>
      </div>
    </div>
  );
}

function TrackersTab({ d, onError }: { d: Details; onError: (e: unknown) => void }) {
  const { t, gate, date } = useUi();
  const [url, setUrl] = useState("");
  const hint = gate("addTracker");
  const add = async (e: FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    try {
      await api.addTracker(d.id, url.trim());
      setUrl("");
    } catch (err) {
      onError(err);
    }
  };
  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-tx-accent-900/30">
          <thead>
            <tr>
              {["url", "status", "seeds", "peers", "lastAnnounce", "nextAnnounce"].map((c) => (
                <th key={c} className={th}>
                  {t(`details.tracker.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-tx-accent-900/20">
            {d.trackers.map((tr) => (
              <tr key={tr.url} className="hover:bg-tx-accent-900/10">
                <td className={td}>{tr.url}</td>
                <td className="px-3 py-2 whitespace-nowrap text-sm">
                  {tr.status ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-tx-accent-900/30 text-tx-accent-400">
                      {tr.status}
                    </span>
                  ) : (
                    <span className="text-tx-accent-700">-</span>
                  )}
                </td>
                <td className={td}>{tr.seeds ?? "-"}</td>
                <td className={td}>{tr.peers ?? "-"}</td>
                <td className={td}>{date(tr.lastAnnounce)}</td>
                <td className={td}>{date(tr.nextAnnounce)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form onSubmit={add} className="mt-4 flex items-center gap-2" title={hint}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={!!hint}
          placeholder="udp://tracker.example:1337/announce"
          className="flex-1 max-w-md bg-tx-surface-900 border border-tx-accent-900/50 rounded px-3 py-1 text-xs text-tx-accent-400 placeholder-tx-accent-700 focus:outline-none focus:ring-1 focus:ring-tx-accent-700 disabled:opacity-50"
        />
        <button type="submit" disabled={!!hint} className={softButtonClass}>
          {t("details.addTracker")}
        </button>
      </form>
    </div>
  );
}

export function TorrentDetails({ id, onClose, onError, onPollError }: TorrentDetailsProps) {
  const { t, gate, prefs, date } = useUi();
  const [activeTab, setActiveTab] = useState<DetailTab>("general");
  const peersHint = gate("peerList");
  const piecesHint = gate("pieces");
  const wantPeers = (activeTab === "peers" || activeTab === "seeds") && !peersHint;
  const wantPieces = activeTab === "general" && prefs.showPieceMap && !piecesHint;
  const { details, peers, pieces } = useDetails(id, { peers: wantPeers, pieces: wantPieces }, { onError: onPollError });
  const d = details.data;
  const [hist, setHist] = useState<{ id: string; down: number[]; up: number[] }>({ id, down: [], up: [] });

  useEffect(() => {
    if (!d) return;
    setHist((h) => {
      const base = h.id === d.id ? h : { id: d.id, down: [], up: [] };
      return {
        id: d.id,
        down: [...base.down, d.downloadRate].slice(-SAMPLES),
        up: [...base.up, d.uploadRate].slice(-SAMPLES),
      };
    });
  }, [d]);

  const tabs: { id: DetailTab; icon: ReactNode }[] = [
    { id: "general", icon: <FileText size={14} /> },
    { id: "trackers", icon: <Globe size={14} /> },
    { id: "peers", icon: <Users size={14} /> },
    { id: "seeds", icon: <Server size={14} /> },
    { id: "files", icon: <FileIcon size={14} /> },
  ];

  const renderTabContent = (d: Details) => {
    switch (activeTab) {
      case "general":
        return (
          <>
            {prefs.showSpeedGraph && <Graph down={hist.down} up={hist.up} d={d} />}
            {prefs.showPieceMap && pieces.data && <PieceMap bitfield={pieces.data.bitfield} count={pieces.data.count} />}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mb-2">
                  {t("details.generalInfo")}
                </h4>
                <DetailItem icon={<Activity size={14} />} label={t("details.status")} value={d.error ? `${t(`status.${d.status}`)}: ${d.error}` : t(`status.${d.status}`)} />
                <DetailItem icon={<FileText size={14} />} label={t("details.totalSize")} value={bytes(d.size)} />
                <DetailItem icon={<Download size={14} />} label={t("details.downloaded")} value={`${bytes(d.downloaded)} (${percent(d.progress)})`} />
                <DetailItem icon={<Upload size={14} />} label={t("details.uploaded")} value={bytes(d.uploaded)} />
                <DetailItem icon={<Share2 size={14} />} label={t("details.ratio")} value={d.ratio == null ? "-" : d.ratio.toFixed(2)} />
                <DetailItem icon={<Users size={14} />} label={t("details.seedsPeers")} value={`${d.seeds} / ${d.peers}`} />
                <DetailItem icon={<Calendar size={14} />} label={t("details.added")} value={date(d.addedAt)} />
                <DetailItem icon={<User size={14} />} label={t("details.createdBy")} value={d.createdBy ?? "-"} />
                <DetailItem icon={<Calendar size={14} />} label={t("details.createdAt")} value={date(d.createdAt)} />
                <DetailItem icon={<MessageSquare size={14} />} label={t("details.comment")} value={d.comment || "-"} />
              </div>
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mb-2">
                  {t("details.technical")}
                </h4>
                <DetailItem icon={<HardDrive size={14} />} label={t("details.savePath")} value={d.savePath} />
                <DetailItem icon={<Hash size={14} />} label={t("details.hash")} value={d.id} />
                <DetailItem icon={<Clock size={14} />} label={t("details.eta")} value={d.status === "paused" ? t("status.paused") : eta(d)} />
                <DetailItem icon={<Download size={14} />} label={t("details.downloadSpeed")} value={rate(d.downloadRate)} />
                <DetailItem icon={<Upload size={14} />} label={t("details.uploadSpeed")} value={rate(d.uploadRate)} />
                <DetailItem icon={<FileText size={14} />} label={t("details.piecesInfo")} value={d.pieces && d.pieceSize ? `${d.pieces} × ${bytes(d.pieceSize)}` : "-"} />
                <DetailItem icon={<Users size={14} />} label={t("details.availability")} value={d.availability == null ? "-" : d.availability.toFixed(2)} />
                <DetailItem icon={<Trash size={14} />} label={t("details.wasted")} value={d.wasted == null ? "-" : bytes(d.wasted)} />
                <DetailItem icon={<Globe size={14} />} label={t("details.tracker")} value={d.trackers[0]?.url ?? "-"} />
              </div>
            </div>
          </>
        );
      case "trackers":
        return <TrackersTab d={d} onError={onError} />;
      case "peers":
        return <PeerTable peers={peers.data} gateHint={peersHint} />;
      case "seeds":
        return <PeerTable peers={peers.data?.filter((p) => p.isSeed) ?? null} gateHint={peersHint} />;
      case "files":
        return <FilesTab d={d} onError={onError} />;
    }
  };

  return (
    <div className="border-t border-tx-accent-900/30 bg-tx-base h-64 overflow-y-auto text-sm">
      <div className="flex justify-between items-center p-3 border-b border-tx-accent-900/30 bg-tx-surface-950 sticky top-0 z-20">
        <div className="flex items-center min-w-0">
          <div className={`w-2 h-2 rounded-full mr-2 shrink-0 ${d ? statusColor(d.status) : "bg-gray-600"}`}></div>
          <h3 className="text-tx-accent-400 font-semibold truncate">{d?.name ?? "…"}</h3>
        </div>
        <button
          onClick={onClose}
          aria-label={t("common.close")}
          className="text-tx-accent-500 hover:text-tx-accent-400 p-1 rounded-md hover:bg-tx-surface-900 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex border-b border-tx-accent-900/30 bg-tx-surface-950/50 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center px-4 py-2 text-xs font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-tx-accent-500 text-tx-accent-400" : "border-transparent text-tx-accent-600 hover:text-tx-accent-500 hover:border-tx-accent-700"}`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {t(`details.tab.${tab.id}`)}
          </button>
        ))}
      </div>
      <div className="p-4">
        {d ? renderTabContent(d) : details.error ? <p className="text-xs text-red-400">{details.error.message}</p> : null}
      </div>
    </div>
  );
}
