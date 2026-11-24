import { IS_MAC, keyCaps } from "../lib/keymap";

/** A binding drawn as key caps (`⌘ ⇧ P` on macOS, `Ctrl Shift P` elsewhere). */
export function KeyCaps({ binding, tone = "bg-ui-surface-3 text-ui-text-2" }: { binding: string; tone?: string }) {
  return (
    <span className="flex shrink-0 items-center gap-[4px]">
      {keyCaps(binding, IS_MAC).map((cap, i) => (
        <kbd key={i} className={`rounded-[5px] px-[6px] py-[3px] font-code text-[10px] leading-none ${tone}`}>
          {cap}
        </kbd>
      ))}
    </span>
  );
}
