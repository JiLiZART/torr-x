import { ArrowDown, ArrowUp, HardDrive, Cpu } from "lucide-react";
import type { Stats } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { bytes, rate } from "../lib/format";

export function StatusBar({ stats }: { stats: Stats | null }) {
  const { t } = useUi();
  const s = stats;
  return (
    <div className="border-t border-tx-accent-900/30 bg-tx-surface-950 py-1 px-4 text-xs text-tx-accent-600 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <ArrowDown size={12} className="mr-1 text-tx-accent-500" />
          <span>{s ? rate(s.downloadRate) : "-"}</span>
        </div>
        <div className="flex items-center">
          <ArrowUp size={12} className="mr-1 text-tx-accent-500" />
          <span>{s ? rate(s.uploadRate) : "-"}</span>
        </div>
        <div>
          <span>{t("status.ratio", { ratio: s?.ratio == null ? "-" : s.ratio.toFixed(2) })}</span>
        </div>
      </div>
      <div className="flex items-center space-x-4">
        <div className="flex items-center">
          <HardDrive size={12} className="mr-1 text-tx-accent-500" />
          <span>{t("status.free", { size: s?.diskFree == null ? "-" : bytes(s.diskFree) })}</span>
        </div>
        <div className="flex items-center">
          <Cpu size={12} className="mr-1 text-tx-accent-500" />
          <span>{t("status.cpu", { cpu: s ? Math.round(s.cpuPercent) : "-" })}</span>
        </div>
        <div>
          <span>{t("status.mem", { mem: s ? bytes(s.memoryBytes) : "-" })}</span>
        </div>
        <div>
          <span>{t("status.counts", { n: s?.torrents ?? 0, m: s?.active ?? 0 })}</span>
        </div>
      </div>
    </div>
  );
}
