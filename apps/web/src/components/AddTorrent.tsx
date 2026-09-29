import { useRef, useState, type DragEvent } from "react";
import { FileUp, Plus } from "lucide-react";
import { api } from "@torrentx/api-client";
import { Modal, buttonClass, inputClass, primaryButtonClass } from "./Modal";

interface AddTorrentProps {
  onClose: () => void;
  onAdded: () => void;
}

export function AddTorrent({ onClose, onAdded }: AddTorrentProps) {
  const [uris, setUris] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) =>
    setFiles((prev) => [...prev, ...[...(list ?? [])].filter((f) => f.name.endsWith(".torrent"))]);

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation(); // don't also trigger the window-level drop handler
    addFiles(e.dataTransfer.files);
  };

  const submit = async () => {
    setBusy(true);
    const lines = uris.split("\n").map((l) => l.trim()).filter(Boolean);
    const jobs = [
      ...lines.map((uri) => ({ label: uri, run: () => api.addUri(uri) })),
      ...files.map((f) => ({ label: f.name, run: () => api.addFile(f) })),
    ];
    const failed: string[] = [];
    for (const job of jobs) {
      await job.run().catch((e: Error) => failed.push(`${job.label}: ${e.message}`));
    }
    setBusy(false);
    onAdded();
    if (failed.length === 0) onClose();
    else {
      setErrors(failed);
      setUris("");
      setFiles([]);
    }
  };

  const empty = !uris.trim() && files.length === 0;

  return (
    <Modal
      title={
        <>
          <Plus size={16} className="mr-2" /> Add torrent
        </>
      }
      onClose={onClose}
      footer={
        <>
          <button className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button className={primaryButtonClass} onClick={submit} disabled={busy || empty}>
            {busy ? "Adding…" : "Add"}
          </button>
        </>
      }
    >
      <label className="block text-xs text-green-600 mb-1">Magnet links or .torrent URLs (one per line)</label>
      <textarea
        className={`${inputClass} h-24 resize-none`}
        value={uris}
        onChange={(e) => setUris(e.target.value)}
        placeholder="magnet:?xt=urn:btih:..."
        autoFocus
      />
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        className="mt-4 border border-dashed border-green-900/70 rounded-md p-6 text-center text-sm text-green-600 cursor-pointer hover:bg-gray-900/50"
      >
        <FileUp size={18} className="mx-auto mb-2" />
        Drop .torrent files here or click to choose
        <input
          ref={fileInput}
          type="file"
          accept=".torrent,application/x-bittorrent"
          multiple
          hidden
          onChange={(e) => addFiles(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-2 text-xs text-green-400">
          {files.map((f, i) => (
            <li key={i} className="truncate">
              + {f.name}
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 && (
        <ul className="mt-3 text-xs text-red-400 space-y-1">
          {errors.map((e, i) => (
            <li key={i} className="break-all">
              {e}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
