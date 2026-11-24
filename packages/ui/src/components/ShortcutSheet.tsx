import { useEffect } from "react";
import { Keyboard, X } from "lucide-react";
import { useUi } from "../lib/context";
import { COMMANDS, type Group } from "../lib/commands";
import { IS_MAC, keyCaps, usableKeys } from "../lib/keymap";
import { KeyCaps } from "./KeyCaps";

const GROUPS: Group[] = ["palette", "tabs", "lens", "list", "navigation"];
/** What typing at the start of the palette input does. */
const PREFIXES = [
  [">", "commands"],
  ["@ ␣", "files"],
  ["torrent: ␣", "pickTorrent"],
] as const;

/** ⌘K: every binding, grouped by surface, as it works where the UI runs. */
export function ShortcutSheet({ desktop, onClose }: { desktop: boolean; onClose: () => void }) {
  const { t } = useUi();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal aria-label={t("sheet.title")}>
      <button className="absolute inset-0 cursor-default bg-ui-bg/60 backdrop-blur-[7px]" aria-label={t("common.close")} tabIndex={-1} onClick={onClose} />
      <div className="absolute left-1/2 top-[64px] flex max-h-[calc(100vh-110px)] w-[880px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col overflow-hidden rounded-[18px] border border-ui-border-strong bg-ui-surface font-ui shadow-[0_24px_60px_rgba(0,0,0,0.66)]">
        <div className="flex items-center gap-[10px] border-b border-ui-border px-[18px] py-[14px]">
          <Keyboard size={16} className="text-ui-accent" />
          <span className="text-[14px] font-semibold text-ui-text">{t("sheet.title")}</span>
          <span className="font-code text-[10px] text-ui-text-3">{t(IS_MAC ? "sheet.macHint" : "sheet.pcHint")}</span>
          <span className="flex-1" />
          <button onClick={onClose} aria-label={t("common.close")} className="text-ui-text-3 hover:text-ui-text">
            <X size={15} />
          </button>
        </div>
        <div className="grid min-h-0 grid-cols-1 gap-x-[28px] gap-y-[18px] overflow-y-auto p-[18px] md:grid-cols-2">
          {GROUPS.map((group) => (
            <section key={group} className="flex flex-col gap-[2px]">
              <h3 className="pb-[6px] font-code text-[9px] tracking-[1.2px] text-ui-text-3">{t(`sheet.group.${group}`)}</h3>
              {COMMANDS.filter((def) => def.group === group && def.keys.length > 0).map((def) => {
                const keys = usableKeys(def.keys, desktop);
                return (
                  <div key={def.id} className="flex items-center gap-[10px] rounded-[8px] px-[8px] py-[5px] hover:bg-ui-surface-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ui-text">{t(`cmd.${def.id}`)}</span>
                    <span className="shrink-0 font-code text-[9px] text-ui-text-3">{def.local ? t(`sheet.where.${group === "lens" ? "chips" : "list"}`) : t(`palette.scope.${def.scope}`)}</span>
                    {keys.length > 0 ? (
                      <KeyCaps binding={keys[0]} />
                    ) : (
                      <span className="shrink-0 font-code text-[10px] text-ui-text-3" title={keyCaps(def.keys[0], IS_MAC).join(" ")}>
                        {t("sheet.desktopOnly")}
                      </span>
                    )}
                  </div>
                );
              })}
              {group === "palette" &&
                PREFIXES.map(([typed, key]) => (
                  <div key={key} className="flex items-center gap-[10px] rounded-[8px] px-[8px] py-[5px] hover:bg-ui-surface-2">
                    <span className="min-w-0 flex-1 truncate text-[12px] text-ui-text">{t(`sheet.prefix.${key}`)}</span>
                    <span className="shrink-0 font-code text-[9px] text-ui-text-3">{t("sheet.where.typed")}</span>
                    <span className="shrink-0 rounded-[5px] border border-ui-border bg-ui-surface-2 px-[6px] py-[2px] font-code text-[10px] text-ui-text-2">{typed}</span>
                  </div>
                ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
