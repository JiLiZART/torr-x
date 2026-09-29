import { Fragment, useMemo, useRef, useState, type ReactNode } from "react";
import {
  X,
  Link,
  Upload,
  Magnet,
  Plus,
  HardDrive,
  Download,
  FileText,
  Info,
  ChevronRight,
  ChevronDown,
  FileIcon,
  FolderIcon,
  CheckSquare,
  Square,
  Calendar,
  Hash,
  ArrowLeft,
  Save,
} from "lucide-react";
import { api, type AddOptions, type Preview, type Priority, type Settings } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { bytes } from "../lib/format";
import { buildTree, type TreeNode } from "../lib/tree";

interface AddTorrentProps {
  onClose: () => void;
  onAdded: () => void;
  initialFile?: File;
  settings: Settings | null;
  diskFree: number | null;
}

type AddTorrentTab = "url" | "file" | "magnet";
type PreviewFile = Preview["files"][number];

const inputBase =
  "bg-tx-surface-900 border border-tx-accent-900/50 rounded px-3 py-2 text-sm text-tx-accent-400 placeholder-tx-accent-700 focus:outline-none focus:ring-1 focus:ring-tx-accent-700";
const checkbox =
  "h-4 w-4 rounded border-tx-accent-900/50 bg-tx-surface-900 checked:bg-tx-accent-700 focus:ring-0 focus:ring-offset-0";

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

function Spinner() {
  return (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-tx-accent-100" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

export function AddTorrent({ onClose, onAdded, initialFile, settings, diskFree }: AddTorrentProps) {
  const { t, gate, date } = useUi();
  const [activeTab, setActiveTab] = useState<AddTorrentTab>(initialFile ? "file" : "url");
  const [url, setUrl] = useState("");
  const [magnetLink, setMagnetLink] = useState("");
  const [file, setFile] = useState<File | null>(initialFile ?? null);
  const dl = settings?.downloads;
  const [downloadPath, setDownloadPath] = useState(
    // Empty on Transmission = the daemon's own download dir (may be on another host).
    dl?.defaultSavePath || (settings?.engine.kind === "rqbit" ? settings.engine.rqbit.downloadDir : ""),
  );
  const [createSubfolder, setCreateSubfolder] = useState(dl?.createSubfolder ?? true);
  const [startTorrent, setStartTorrent] = useState(dl?.startAutomatically ?? true);
  const [priority, setPriority] = useState<Priority>(dl?.defaultPriority ?? "normal");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showTorrentInfo, setShowTorrentInfo] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const priorityHint = gate("torrentPriority");
  const tree = useMemo(() => (preview ? buildTree(preview.files) : []), [preview]);

  const uri = activeTab === "url" ? url.trim() : activeTab === "magnet" ? magnetLink.trim() : "";

  const validate = () => {
    if (activeTab === "url" && !uri) return t("add.errUrl");
    if (activeTab === "file" && !file) return t("add.errFile");
    if (activeTab === "magnet" && !uri) return t("add.errMagnet");
    return "";
  };

  const add = async (wantedFiles?: number[]) => {
    const opts: AddOptions = {
      createSubfolder,
      paused: !startTorrent,
      ...(downloadPath.trim() && { savePath: downloadPath.trim() }),
      ...(!priorityHint && { priority }),
      ...(wantedFiles && { wantedFiles }),
    };
    if (activeTab === "file" && file) await api.addFile(file, opts);
    else await api.addUri(uri, opts);
    onAdded();
    onClose();
  };

  const busy = async (fn: () => Promise<void>) => {
    setError("");
    setIsSubmitting(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const invalid = validate();
    if (invalid) return setError(invalid);
    void busy(async () => {
      if (gate("addPreview")) return add();
      const p = activeTab === "file" && file ? await api.previewFile(file) : await api.previewUri(uri);
      setPreview(p);
      setSelected(new Set(p.files.map((f) => f.index)));
      setCollapsed(new Set());
    });
  };

  const finalize = () => {
    if (!preview) return;
    if (selected.size === 0) return setError(t("add.errNoFiles"));
    const all = selected.size === preview.files.length;
    void busy(() => add(all ? undefined : [...selected]));
  };

  const toggleSelection = (indices: number[]) =>
    setSelected((s) => {
      const next = new Set(s);
      const on = !indices.every((i) => s.has(i));
      indices.forEach((i) => (on ? next.add(i) : next.delete(i)));
      return next;
    });
  const toggleFolder = (path: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const renderFileTree = (nodes: TreeNode<PreviewFile>[], level = 0): ReactNode =>
    nodes.map((n) => {
      const isFolder = !n.file;
      const isExpanded = !collapsed.has(n.path);
      const isSelected = n.indices.every((i) => selected.has(i));
      return (
        <Fragment key={(isFolder ? "d:" : "f:") + n.path}>
          <tr className="hover:bg-tx-accent-900/10 cursor-pointer" onClick={() => toggleSelection(n.indices)}>
            <td className="px-3 py-2 whitespace-nowrap text-sm text-tx-accent-400">
              <div className="flex items-center" style={{ paddingLeft: `${level * 16}px` }}>
                <button
                  className="mr-2 focus:outline-none text-tx-accent-500 hover:text-tx-accent-300"
                  aria-label={n.name}
                  aria-pressed={isSelected}
                >
                  {isSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                </button>
                {isFolder ? (
                  <button
                    className="mr-1 focus:outline-none text-tx-accent-600 hover:text-tx-accent-400"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFolder(n.path);
                    }}
                  >
                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  </button>
                ) : (
                  <span className="ml-4"></span>
                )}
                <span className="mr-2">
                  {isFolder ? <FolderIcon size={14} className="text-yellow-500" /> : <FileIcon size={14} />}
                </span>
                {n.name}
              </div>
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-sm text-tx-accent-400">{bytes(n.size)}</td>
          </tr>
          {isFolder && isExpanded && renderFileTree(n.children, level + 1)}
        </Fragment>
      );
    });

  const header = (icon: ReactNode, title: string) => (
    <div className="flex justify-between items-center p-4 border-b border-tx-accent-900/30">
      <h2 className="text-tx-accent-400 font-semibold flex items-center">
        {icon}
        {title}
      </h2>
      <button
        onClick={onClose}
        aria-label={t("common.close")}
        className="text-tx-accent-500 hover:text-tx-accent-400 p-1 rounded-md hover:bg-tx-surface-900 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
  const errorBox = error && (
    <div className="mt-4 bg-red-900/20 border-l-4 border-red-500 p-3 rounded">
      <p className="text-xs text-red-400">{error}</p>
    </div>
  );
  const free = diskFree == null ? "-" : bytes(diskFree);

  if (preview) {
    const required = preview.files.filter((f) => selected.has(f.index)).reduce((a, f) => a + f.size, 0);
    return (
      <div className="fixed inset-0 bg-tx-base/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-tx-surface-950 border border-tx-accent-900/50 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
          {header(<Download size={16} className="mr-2" />, t("add.selectFiles"))}
          <div className="flex flex-1 overflow-hidden">
            <div className="flex-1 flex flex-col overflow-hidden border-r border-tx-accent-900/30">
              <div className="p-3 border-b border-tx-accent-900/30 bg-tx-base/30 flex justify-between items-center">
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelected(new Set(preview.files.map((f) => f.index)))}
                    className="text-xs bg-tx-accent-900/30 hover:bg-tx-accent-900/50 text-tx-accent-400 py-1 px-2 rounded-md transition-colors"
                  >
                    {t("add.selectAll")}
                  </button>
                  <button
                    onClick={() => setSelected(new Set())}
                    className="text-xs bg-tx-accent-900/30 hover:bg-tx-accent-900/50 text-tx-accent-400 py-1 px-2 rounded-md transition-colors"
                  >
                    {t("add.selectNone")}
                  </button>
                </div>
                <button
                  onClick={() => setShowTorrentInfo(!showTorrentInfo)}
                  className="text-xs bg-tx-accent-900/30 hover:bg-tx-accent-900/50 text-tx-accent-400 py-1 px-2 rounded-md transition-colors flex items-center"
                >
                  <Info size={12} className="mr-1.5" />
                  {showTorrentInfo ? t("add.hideInfo") : t("add.showInfo")}
                </button>
              </div>
              <div className="overflow-y-auto flex-1">
                <table className="min-w-full divide-y divide-tx-accent-900/30">
                  <thead>
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-tx-accent-700 uppercase tracking-wider">
                        {t("details.file.name")}
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-tx-accent-700 uppercase tracking-wider">
                        {t("details.file.size")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tx-accent-900/20">{renderFileTree(tree)}</tbody>
                </table>
              </div>
            </div>
            {showTorrentInfo && (
              <div className="w-72 bg-tx-base/30 overflow-y-auto p-4">
                <h3 className="text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mb-3">
                  {t("add.info")}
                </h3>
                <DetailItem icon={<FileText size={14} />} label={t("add.name")} value={preview.name} />
                <DetailItem icon={<FileText size={14} />} label={t("details.totalSize")} value={bytes(preview.size)} />
                <DetailItem icon={<FileText size={14} />} label={t("add.files")} value={preview.files.length} />
                <DetailItem icon={<Calendar size={14} />} label={t("details.createdAt")} value={date(preview.createdAt)} />
                <DetailItem icon={<Hash size={14} />} label={t("details.hash")} value={preview.id} />
                <DetailItem icon={<FileText size={14} />} label={t("details.comment")} value={preview.comment || "-"} />
                <h4 className="text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mt-4 mb-2">
                  {t("details.tab.trackers")}
                </h4>
                <div className="text-xs text-tx-accent-400 space-y-1 border border-tx-accent-900/30 rounded p-2 bg-tx-base/30 max-h-28 overflow-y-auto">
                  {preview.trackers.length === 0 && <div>-</div>}
                  {preview.trackers.map((tracker) => (
                    <div key={tracker} className="break-all">
                      {tracker}
                    </div>
                  ))}
                </div>
                <h4 className="text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mt-4 mb-2">
                  {t("details.technical")}
                </h4>
                <DetailItem icon={<FileText size={14} />} label={t("add.pieceSize")} value={bytes(preview.pieceSize)} />
                <DetailItem icon={<FileText size={14} />} label={t("add.pieces")} value={preview.pieces} />
              </div>
            )}
          </div>
          <div className="border-t border-tx-accent-900/30 p-4 bg-tx-base/30">
            <div className="flex justify-between items-center mb-3">
              <label className="text-sm text-tx-accent-400">{t("add.saveTo")}</label>
              <input
                type="text"
                value={downloadPath}
                  placeholder={t("add.daemonDefault")}
                onChange={(e) => setDownloadPath(e.target.value)}
                className="bg-tx-surface-900 border border-tx-accent-900/50 rounded px-3 py-1.5 text-sm text-tx-accent-400 focus:outline-none focus:ring-1 focus:ring-tx-accent-700 w-80"
              />
            </div>
            {errorBox}
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-tx-accent-700 flex items-center">
                <HardDrive size={12} className="mr-1.5" />
                {t("add.diskRequired", { required: bytes(required), free })}
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setPreview(null)}
                  className="flex items-center text-xs bg-tx-surface-800 hover:bg-tx-surface-700 text-tx-accent-400 py-1.5 px-4 rounded-md transition-colors"
                >
                  <ArrowLeft size={12} className="mr-1.5" />
                  {t("add.back")}
                </button>
                <button
                  onClick={finalize}
                  disabled={isSubmitting}
                  className="flex items-center text-xs bg-tx-accent-800 hover:bg-tx-accent-700 text-tx-accent-100 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? <Spinner /> : <Save size={12} className="mr-1.5" />}
                  {t("add.add")}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabButton = (id: AddTorrentTab, icon: ReactNode, label: string) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === id ? "border-tx-accent-500 text-tx-accent-400" : "border-transparent text-tx-accent-600 hover:text-tx-accent-500 hover:border-tx-accent-700"}`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 bg-tx-base/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-tx-surface-950 border border-tx-accent-900/50 rounded-lg shadow-xl w-full max-w-xl">
        {header(<Plus size={16} className="mr-2" />, t("add.title"))}
        <div className="p-4">
          <div className="flex border-b border-tx-accent-900/30 mb-4">
            {tabButton("url", <Link size={14} className="mr-2" />, t("add.tabUrl"))}
            {tabButton("file", <Upload size={14} className="mr-2" />, t("add.tabFile"))}
            {tabButton("magnet", <Magnet size={14} className="mr-2" />, t("add.tabMagnet"))}
          </div>
          {activeTab === "url" && (
            <div className="mb-4">
              <label className="block text-sm text-tx-accent-400 mb-1">{t("add.urlLabel")}</label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/file.torrent"
                className={`w-full ${inputBase}`}
                autoFocus
              />
              <p className="text-xs text-tx-accent-700 mt-1">{t("add.urlHint")}</p>
            </div>
          )}
          {activeTab === "file" && (
            <div className="mb-4">
              <label className="block text-sm text-tx-accent-400 mb-1">{t("add.fileLabel")}</label>
              <div className="flex items-center">
                <input
                  type="text"
                  value={file?.name ?? ""}
                  readOnly
                  placeholder={t("add.noFile")}
                  className="flex-1 bg-tx-surface-900 border border-tx-accent-900/50 rounded-l px-3 py-2 text-sm text-tx-accent-400 placeholder-tx-accent-700 focus:outline-none"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-tx-accent-900/50 hover:bg-tx-accent-900/70 text-tx-accent-400 py-2 px-4 rounded-r border border-tx-accent-900/50 transition-colors"
                >
                  {t("add.browse")}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".torrent"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-tx-accent-700 mt-1">{t("add.fileHint")}</p>
            </div>
          )}
          {activeTab === "magnet" && (
            <div className="mb-4">
              <label className="block text-sm text-tx-accent-400 mb-1">{t("add.magnetLabel")}</label>
              <textarea
                value={magnetLink}
                onChange={(e) => setMagnetLink(e.target.value)}
                placeholder="magnet:?xt=urn:btih:..."
                rows={3}
                className={`w-full ${inputBase}`}
                autoFocus
              />
              <p className="text-xs text-tx-accent-700 mt-1">{t("add.magnetHint")}</p>
            </div>
          )}
          <div className="border-t border-tx-accent-900/30 mt-6 pt-4">
            <h3 className="text-xs font-semibold text-tx-accent-700 uppercase tracking-wider mb-3">
              {t("add.options")}
            </h3>
            <div className="mb-4">
              <label className="block text-sm text-tx-accent-400 mb-1">{t("add.saveLocation")}</label>
              <input
                type="text"
                value={downloadPath}
                  placeholder={t("add.daemonDefault")}
                onChange={(e) => setDownloadPath(e.target.value)}
                className={`w-full ${inputBase}`}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="createSubfolder"
                  checked={createSubfolder}
                  onChange={() => setCreateSubfolder(!createSubfolder)}
                  className={checkbox}
                />
                <label htmlFor="createSubfolder" className="ml-2 text-sm text-tx-accent-400">
                  {t("add.createSubfolder")}
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="startTorrent"
                  checked={startTorrent}
                  onChange={() => setStartTorrent(!startTorrent)}
                  className={checkbox}
                />
                <label htmlFor="startTorrent" className="ml-2 text-sm text-tx-accent-400">
                  {t("add.start")}
                </label>
              </div>
              <div title={priorityHint}>
                <label className="block text-sm text-tx-accent-400 mb-1">{t("add.priority")}</label>
                <select
                  value={priority}
                  disabled={!!priorityHint}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className={`w-full ${inputBase} disabled:opacity-50`}
                >
                  <option value="high">{t("details.priority.high")}</option>
                  <option value="normal">{t("details.priority.normal")}</option>
                  <option value="low">{t("details.priority.low")}</option>
                </select>
              </div>
            </div>
          </div>
          {errorBox}
        </div>
        <div className="border-t border-tx-accent-900/30 p-4 bg-tx-base/30 flex items-center justify-between">
          <div className="text-xs text-tx-accent-700">
            <span className="flex items-center">
              <HardDrive size={12} className="mr-1.5" />
              {t("add.diskFree", { free })}
            </span>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="text-xs bg-tx-surface-800 hover:bg-tx-surface-700 text-tx-accent-400 py-1.5 px-4 rounded-md transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center text-xs bg-tx-accent-800 hover:bg-tx-accent-700 text-tx-accent-100 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="flex items-center">
                  <Spinner />
                  {t("add.processing")}
                </span>
              ) : (
                <>
                  <Download size={12} className="mr-1.5" />
                  {gate("addPreview") ? t("add.add") : t("add.next")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
