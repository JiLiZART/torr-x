import { ChevronDown, ChevronUp, HardDrive, SquareTerminal } from "lucide-react";
import type { EngineKind, Stats } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { bytes } from "../lib/format";

interface StatusBarProps {
  /** Rows in the list: the same evaluation the list renders. */
  shown: number;
  total: number;
  lensActive: boolean;
  engine?: EngineKind;
  engineError: string | null;
  stats: Stats | null;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
}

export function StatusBar({ shown, total, lensActive, engine, engineError, stats, terminalOpen, onToggleTerminal }: StatusBarProps) {
  const { t } = useUi();
  return (
    <footer className="flex h-8 shrink-0 items-center gap-4 border-t border-tx-accent-900/30 bg-tx-surface-950 px-4 text-xs text-tx-accent-600">
      <span>{t(lensActive ? "status.matchLens" : "status.match", { n: shown, m: total })}</span>
      <span className="flex-1" />
      {engine && (
        <span className="flex items-center gap-1.5" title={engineError ?? undefined}>
          <span className={`h-1.5 w-1.5 rounded-full ${engineError ? "bg-red-500" : "bg-tx-accent-500"}`} />
          {engine} · {engineError ? t("status.engineDown") : t("status.engineOk")}
        </span>
      )}
      <span className="flex items-center gap-1">
        <HardDrive size={12} />
        {t("status.free", { size: stats?.diskFree == null ? "-" : bytes(stats.diskFree) })}
      </span>
      <button onClick={onToggleTerminal} aria-expanded={terminalOpen} className="flex items-center gap-1.5 rounded-md bg-tx-surface-900 px-2 py-0.5 text-tx-accent-500 hover:bg-tx-surface-800">
        <SquareTerminal size={12} />
        {t("header.terminal")}
        <kbd className="text-tx-accent-700">⌃`</kbd>
        {terminalOpen ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
      </button>
    </footer>
  );
}
