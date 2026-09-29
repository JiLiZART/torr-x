import { useCallback, useState } from "react";
import { X } from "lucide-react";
import { api, type TorrentDetails as Details, type Torrent } from "@torrentx/api-client";
import { bytes, date, eta, percent, rate } from "../lib/format";
import { usePoll } from "../lib/usePoll";

interface TorrentDetailsProps {
  torrent: Torrent;
  onClose: () => void;
  onError: (e: unknown) => void;
}

export function TorrentDetails({ torrent, onClose, onError }: TorrentDetailsProps) {
  const [details, setDetails] = useState<Details | null>(null);
  const load = useCallback(
    () => api.get(torrent.id).then(setDetails, onError),
    [torrent.id, onError],
  );
  usePoll(load, 3000);

  // Live numbers come from the list poll; files from the details poll.
  const t = torrent;
  const files = details?.id === t.id ? details.files : [];
  const info: [string, string][] = [
    ["Status", t.error ? `${t.status}: ${t.error}` : t.status],
    ["Hash", t.id],
    ["Size", bytes(t.size)],
    ["Progress", percent(t.progress)],
    ["Down / Up", `${rate(t.downloadRate)} / ${rate(t.uploadRate)}`],
    ["Peers / Seeds", `${t.peers} / ${t.seeds}`],
    ["ETA", eta(t)],
    ["Added", date(t.addedAt)],
    ["Save path", t.savePath],
  ];

  return (
    <div className="h-2/5 min-h-48 border-t border-green-900/50 bg-gray-950 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-green-900/30">
        <h3 className="text-sm text-green-400 font-semibold truncate">{t.name}</h3>
        <button onClick={onClose} className="text-green-500 hover:text-green-400 p-1 rounded-md hover:bg-gray-900">
          <X size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-auto grid grid-cols-1 md:grid-cols-2 gap-4 p-4 text-xs">
        <dl className="grid grid-cols-[7rem_1fr] gap-y-1 content-start">
          {info.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-green-700">{k}</dt>
              <dd className="text-green-400 break-all">{v}</dd>
            </div>
          ))}
        </dl>
        <div>
          <div className="text-green-700 mb-1">Files ({files.length})</div>
          {files.length === 0 && <div className="text-green-800">waiting for metadata…</div>}
          <ul className="space-y-1">
            {files.map((f) => (
              <li key={f.path} className="flex items-center gap-2">
                <span className="flex-1 truncate text-green-400" title={f.path}>
                  {f.path}
                </span>
                <span className="w-16 text-right text-green-600">{bytes(f.size)}</span>
                <span className="w-12 text-right text-green-500">{percent(f.progress)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
