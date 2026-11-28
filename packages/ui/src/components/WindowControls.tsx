import { useEffect, useState } from "react";
import { Copy, Minus, Square, X } from "lucide-react";
import { useUi } from "../lib/context";
import { closeWindow, isTauri, minimizeWindow, toggleMaximizeWindow, WINDOW_STYLE } from "../lib/window";

/** Follows `html[data-maximized]`, which `initDesktopChrome` keeps in sync with the window. */
function useMaximized() {
  const root = document.documentElement;
  const [maximized, setMaximized] = useState(() => root.hasAttribute("data-maximized"));
  useEffect(() => {
    const observer = new MutationObserver(() => setMaximized(root.hasAttribute("data-maximized")));
    observer.observe(root, { attributes: true, attributeFilter: ["data-maximized"] });
    return () => observer.disconnect();
  }, [root]);
  return maximized;
}

/**
 * Desktop window only: close (hide to tray), minimize, maximize. Rendered once by the Shell, pinned to the
 * window corner so it never moves when the sidebar collapses or the view changes: macOS dots top-left,
 * Windows caption buttons and Linux round buttons top-right. `WindowControlsSpace` reserves their room.
 * The dot colors are the OS's, not the theme's.
 */
export function WindowControls() {
  const { t } = useUi();
  const maximized = useMaximized();
  if (!isTauri()) return null;
  if (WINDOW_STYLE === "mac") {
    const dot = "h-[11px] w-[11px] rounded-full";
    return (
      <div className="absolute left-[14px] top-[21px] z-50 flex h-[12px] items-center gap-[7px]">
        <button aria-label={t("window.close")} onClick={closeWindow} className={`${dot} bg-[#FF5F57]`} />
        <button aria-label={t("window.minimize")} onClick={minimizeWindow} className={`${dot} bg-[#FEBC2E]`} />
        <button aria-label={t("window.maximize")} onClick={toggleMaximizeWindow} className={`${dot} bg-[#28C840]`} />
      </div>
    );
  }
  const maxLabel = t(maximized ? "window.restore" : "window.maximize");
  const MaxIcon = maximized ? Copy : Square;
  if (WINDOW_STYLE === "windows") {
    const button = "flex h-[32px] w-[46px] items-center justify-center text-ui-text";
    return (
      <div className="absolute right-0 top-0 z-50 flex">
        <button aria-label={t("window.minimize")} title={t("window.minimize")} onClick={minimizeWindow} className={`${button} hover:bg-ui-surface-2`}>
          <Minus size={13} strokeWidth={1.25} />
        </button>
        <button aria-label={maxLabel} title={maxLabel} onClick={toggleMaximizeWindow} className={`${button} hover:bg-ui-surface-2`}>
          <MaxIcon size={maximized ? 12 : 11} strokeWidth={1.25} />
        </button>
        <button aria-label={t("window.close")} title={t("window.close")} onClick={closeWindow} className={`${button} hover:bg-ui-red`}>
          <X size={14} strokeWidth={1.25} />
        </button>
      </div>
    );
  }
  const button = "flex h-[24px] w-[24px] items-center justify-center rounded-full bg-ui-surface-3 text-ui-text hover:bg-ui-border-strong";
  return (
    <div className="absolute right-[14px] top-[15px] z-50 flex gap-[8px]">
      <button aria-label={t("window.minimize")} title={t("window.minimize")} onClick={minimizeWindow} className={button}>
        <Minus size={12} strokeWidth={2} />
      </button>
      <button aria-label={maxLabel} title={maxLabel} onClick={toggleMaximizeWindow} className={button}>
        <MaxIcon size={maximized ? 11 : 10} strokeWidth={2} />
      </button>
      <button aria-label={t("window.close")} title={t("window.close")} onClick={closeWindow} className={button}>
        <X size={12} strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Empty, draggable room for the pinned window buttons. `left` is the macOS dots (3 × 11px + 2 × 7px), placed in the
 * sidebar head or the collapsed top bar; `right` ends the top bar on Windows (138px of buttons) and Linux (88px plus
 * its 14px inset), leaving a 12px gap.
 */
export function WindowControlsSpace({ side }: { side: "left" | "right" }) {
  if (!isTauri() || (side === "left") !== (WINDOW_STYLE === "mac")) return null;
  const width = side === "left" ? "w-[47px]" : WINDOW_STYLE === "windows" ? "w-[126px]" : "w-[90px]";
  return <span data-tauri-drag-region className={`${width} shrink-0 self-stretch`} />;
}
