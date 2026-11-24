import { ChevronDown, ChevronUp, SquareTerminal } from "lucide-react";
import type { EngineKind, Stats } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { bytes } from "../lib/format";

interface StatusBarProps {
  /** Rows in the list: the same evaluation the list renders. */
  shown: number;
  total: number;
  /** Torrents matching the tab query alone. */
  inTab: number;
  lensActive: boolean;
  engine?: EngineKind;
  engineError: string | null;
  stats: Stats | null;
  terminalOpen: boolean;
  onToggleTerminal: () => void;
}

export function StatusBar({ shown, total, inTab, lensActive, engine, engineError, stats, terminalOpen, onToggleTerminal }: StatusBarProps) {
  const { t } = useUi();
  const counts =
    lensActive && shown === 0 && inTab > 0
      ? t("status.matchNone", { m: total, k: inTab })
      : t(lensActive ? "status.matchLens" : "status.match", { n: shown, m: total });
  return (
    <footer className="flex h-[36px] shrink-0 items-center gap-[12px] border-t border-ui-border bg-ui-chrome px-[16px] font-code text-[10px] text-ui-text-3">
      <span className="truncate">{counts}</span>
      <span className="flex-1" />
      {engine && (
        <span className="flex items-center gap-[6px] whitespace-nowrap" title={engineError ?? undefined}>
          <span className={`h-[6px] w-[6px] rounded-full ${engineError ? "bg-ui-red" : "bg-ui-accent"}`} />
          {engine} · {engineError ? t("status.engineDown") : t("status.engineOk")}
        </span>
      )}
      <span className="whitespace-nowrap">{t("status.free", { size: stats?.diskFree == null ? "—" : bytes(stats.diskFree) })}</span>
      <button
        data-command="terminal.toggle"
        onClick={onToggleTerminal}
        aria-expanded={terminalOpen}
        className="flex items-center gap-[6px] rounded-[7px] border border-ui-border bg-ui-surface-2 px-[9px] py-[5px] text-ui-text-2 hover:border-ui-border-strong"
      >
        <SquareTerminal size={12} />
        <span className="font-ui text-[11px]">{t("header.terminal")}</span>
        <kbd className="font-code text-ui-text-3">⌃`</kbd>
        {terminalOpen ? <ChevronDown size={12} className="text-ui-text-3" /> : <ChevronUp size={12} className="text-ui-text-3" />}
      </button>
    </footer>
  );
}
