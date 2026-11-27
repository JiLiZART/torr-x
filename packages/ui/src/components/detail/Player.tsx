import { useEffect, useState } from "react";
import { ClipboardCopy, ExternalLink, X } from "lucide-react";
import { useUi } from "../../lib/context";

interface PlayerProps {
  name: string;
  src: string;
  local: boolean;
  onClose: () => void;
  onCopy: () => void;
  onExternal: () => void;
}

/** A video on the stream link: seeking is HTTP ranges; codecs the browser lacks show its error and the way out. */
export function Player({ name, src, local, onClose, onCopy, onExternal }: PlayerProps) {
  const { t } = useUi();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Capture phase: Escape closes the player before the app's keymap sees it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  const button = "flex items-center gap-[6px] rounded-[8px] border border-ui-border-strong bg-ui-surface-2 px-[10px] py-[6px] text-[12px] text-ui-text hover:border-ui-text-3";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ui-bg/90 p-[24px] backdrop-blur-sm" role="dialog" aria-modal aria-label={name}>
      <div className="flex max-h-full w-full max-w-[1100px] flex-col overflow-hidden rounded-[12px] border border-ui-border bg-ui-surface">
        <div className="flex items-center gap-[10px] border-b border-ui-border px-[14px] py-[9px]">
          <span className="min-w-0 flex-1 truncate font-code text-[12px] text-ui-text" title={name}>
            {name}
          </span>
          <button className={button} onClick={onCopy}>
            <ClipboardCopy size={13} /> {t("player.copy")}
          </button>
          {local && (
            <button className={button} onClick={onExternal}>
              <ExternalLink size={13} /> {t("player.external")}
            </button>
          )}
          <button className="rounded-[6px] p-[5px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text" aria-label={t("common.close")} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        {error ? (
          <div className="flex flex-col items-center gap-[10px] px-[24px] py-[48px] text-center">
            <p className="text-[13px] text-ui-red">{t("player.error", { message: error })}</p>
            <p className="text-[12px] text-ui-text-2">{t(local ? "player.errorHintLocal" : "player.errorHint")}</p>
          </div>
        ) : (
          <video
            src={src}
            controls
            autoPlay
            className="max-h-[75vh] w-full bg-ui-bg"
            onError={(e) => setError(e.currentTarget.error?.message || t("player.decode"))}
          />
        )}
        <p className="border-t border-ui-border px-[14px] py-[7px] font-code text-[10px] text-ui-text-3">{t("player.note")}</p>
      </div>
    </div>
  );
}
