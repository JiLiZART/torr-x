import { useState } from "react";
import { Trash2 } from "lucide-react";
import { api, type Torrent } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { Modal, buttonClass, dangerButtonClass } from "./Modal";

interface RemoveDialogProps {
  torrent: Torrent;
  deleteData?: boolean;
  onClose: () => void;
  onRemoved: () => void;
}

export function RemoveDialog({ torrent, deleteData: initial = false, onClose, onRemoved }: RemoveDialogProps) {
  const { t } = useUi();
  const [deleteData, setDeleteData] = useState(initial);
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
          <Trash2 size={16} className="mr-2" /> {t("remove.title")}
        </>
      }
      onClose={onClose}
      footer={
        <>
          <button className={buttonClass} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button className={dangerButtonClass} onClick={remove} disabled={busy}>
            {deleteData ? t("remove.confirmErase") : t("remove.confirm")}
          </button>
        </>
      }
    >
      <p className="text-sm text-tx-accent-400 break-all mb-4">{torrent.name}</p>
      <label className="flex items-center gap-2 text-sm text-tx-accent-500 cursor-pointer">
        <input type="checkbox" checked={deleteData} onChange={(e) => setDeleteData(e.target.checked)} />
        {t("remove.alsoData")}
      </label>
      {deleteData && (
        <p className="mt-2 text-xs text-red-400">{t("remove.warning", { path: torrent.savePath })}</p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </Modal>
  );
}
