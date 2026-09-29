import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, type Torrent } from "@torrentx/api-client";
import { Modal, buttonClass, dangerButtonClass } from "./Modal";

interface RemoveDialogProps {
  torrent: Torrent;
  onClose: () => void;
  onRemoved: () => void;
}

export function RemoveDialog({ torrent, onClose, onRemoved }: RemoveDialogProps) {
  const [deleteData, setDeleteData] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remove = async () => {
    setBusy(true);
    try {
      await api.remove(torrent.id, deleteData);
      onRemoved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        <>
          <Trash2 size={16} className="mr-2" /> Remove torrent
        </>
      }
      onClose={onClose}
      footer={
        <>
          <button className={buttonClass} onClick={onClose}>
            Cancel
          </button>
          <button className={dangerButtonClass} onClick={remove} disabled={busy}>
            {deleteData ? "Remove and delete data" : "Remove"}
          </button>
        </>
      }
    >
      <p className="text-sm text-green-400 break-all mb-4">{torrent.name}</p>
      <label className="flex items-center gap-2 text-sm text-green-500 cursor-pointer">
        <input type="checkbox" checked={deleteData} onChange={(e) => setDeleteData(e.target.checked)} />
        Also delete downloaded data
      </label>
      {deleteData && (
        <p className="mt-2 text-xs text-red-400">
          Files in {torrent.savePath} belonging to this torrent will be permanently deleted.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
