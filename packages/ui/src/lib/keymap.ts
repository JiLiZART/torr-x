// Key bindings: platform rendering, event matching, browser-reserved fallbacks and the global listener.
import { useEffect, useRef } from "react";
import type { CommandDef, Handlers } from "./commands.ts";

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Shortcuts a browser tab cannot receive (the browser acts first); the desktop window gets them all. */
const BROWSER_RESERVED = new Set(["Mod+T", "Mod+Shift+T", "Mod+W", "Mod+N", "Mod+1…9", "Ctrl+Tab", "Ctrl+Shift+Tab", "Mod+L"]);

/** The bindings that work where the UI runs; empty when only the desktop app can deliver one. */
export function usableKeys(keys: string[], desktop: boolean): string[] {
  return desktop ? keys : keys.filter((k) => !BROWSER_RESERVED.has(k));
}

const MODS = ["Mod", "Ctrl", "Alt", "Shift"] as const;

/** On Windows/Linux `Mod` and `Ctrl` are the same key. */
function normalize(binding: string, mac: boolean): string {
  const parts = binding.split("+");
  const key = parts.pop()!;
  const mods = new Set(parts.map((m) => (!mac && m === "Ctrl" ? "Mod" : m)));
  return [...MODS.filter((m) => mods.has(m)), key].join("+");
}

const CODE_KEYS: Record<string, string> = {
  Backquote: "`",
  BracketLeft: "[",
  BracketRight: "]",
  Comma: ",",
  Slash: "/",
  Backslash: "\\",
  Space: "Space",
};

/** Canonical binding of a keyboard event, independent of layout quirks (⌥ changes `e.key` on macOS). */
export function eventBinding(e: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">, mac: boolean): string {
  let key = CODE_KEYS[e.code] ?? e.key;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  const mods = [];
  if (mac ? e.metaKey : e.ctrlKey) mods.push("Mod");
  if (mac && e.ctrlKey) mods.push("Ctrl");
  if (e.altKey) mods.push("Alt");
  if (e.shiftKey) mods.push("Shift");
  return [...mods, key].join("+");
}

/** `true` on a match, the digit for a `…1…9` binding, `null` otherwise. */
export function matchBinding(binding: string, event: string, mac: boolean): true | number | null {
  const want = normalize(binding, mac);
  if (want.endsWith("1…9")) {
    const m = /^(.*?)([1-9])$/.exec(event);
    return m && `${m[1]}1…9` === want ? Number(m[2]) : null;
  }
  return want === event ? true : null;
}

const MAC_CAPS: Record<string, string> = { Mod: "⌘", Ctrl: "⌃", Alt: "⌥", Shift: "⇧" };
const KEY_CAPS: Record<string, string> = {
  Enter: "⏎",
  Backspace: "⌫",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Tab: "⇥",
  Escape: "esc",
};

/** Key caps to draw: `["⌘", "⇧", "P"]` on macOS, `["Ctrl", "Shift", "P"]` elsewhere. */
export function keyCaps(binding: string, mac: boolean): string[] {
  const parts = normalize(binding, mac).split("+");
  const key = parts.pop()!;
  const mods = parts.map((m) => (mac ? MAC_CAPS[m] : m === "Mod" ? "Ctrl" : m));
  return [...mods, KEY_CAPS[key] ?? key];
}

const hasModifier = (binding: string) => /(^|\+)(Mod|Ctrl|Alt)\+/.test(binding);

export function isTextField(target: EventTarget | null): boolean {
  return typeof HTMLElement !== "undefined" && target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select"));
}

/** The command (and its digit argument) a key event triggers, honoring the typing guard. */
export function commandFor(
  e: KeyboardEvent | { key: string; code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; target: EventTarget | null },
  defs: CommandDef[],
  opts: { mac: boolean; desktop: boolean },
): { def: CommandDef; arg?: number } | null {
  const event = eventBinding(e, opts.mac);
  const typing = isTextField(e.target);
  for (const def of defs) {
    for (const binding of usableKeys(def.keys, opts.desktop)) {
      const hit = matchBinding(binding, event, opts.mac);
      if (hit === null) continue;
      // A shortcut never fires while typing unless it uses a modifier and does not edit text.
      if (typing && (!hasModifier(binding) || def.textEditing)) return null;
      return { def, arg: hit === true ? undefined : hit };
    }
  }
  return null;
}

/** Window-level hotkeys for every non-local command; suspended while `enabled` is false (dialogs). */
export function useKeymap(defs: CommandDef[], handlers: Handlers, enabled: boolean, desktop: boolean) {
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    if (!enabled) return;
    const global = defs.filter((d) => !d.local);
    const onKey = (e: KeyboardEvent) => {
      const found = commandFor(e, global, { mac: IS_MAC, desktop });
      const handler = found && latest.current[found.def.id];
      if (!found || !handler || handler.unavailable) return;
      e.preventDefault();
      if (!handler.disabled) handler.run(found.arg);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [defs, enabled, desktop]);
}
