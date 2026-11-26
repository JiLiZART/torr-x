import { useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Check, Folder, Minus, Plus, Search, Tag } from "lucide-react";
import { api, type Torrent } from "@torrentx/api-client";
import { useUi } from "../lib/context";

interface TagPickerProps {
  torrents: Torrent[];
  /** Tags and categories already used in the library. */
  tags: string[];
  categories: string[];
  /** Opens below this box (or above when there is no room); centered when null. */
  anchor: DOMRect | null;
  onClose: () => void;
  onChanged: () => void;
  onError: (e: unknown) => void;
}

const WIDTH = 280;
const HEIGHT = 380;
const row = "flex w-full items-center gap-[8px] px-[10px] py-[6px] text-left text-[12px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text";
const head = "px-[10px] pb-[4px] pt-[8px] font-code text-[9px] tracking-[1.2px] text-ui-text-3";

/** Tags (many) and category (one) for one or more torrents; every click saves. */
export function TagPicker({ torrents, tags, categories, anchor, onClose, onChanged, onError }: TagPickerProps) {
  const { t } = useUi();
  const [state, setState] = useState(() => torrents.map((r) => ({ id: r.id, tags: r.tags, category: r.category })));
  const [text, setText] = useState("");
  const needle = text.trim().toLowerCase();
  const knownTags = [...new Set([...tags, ...state.flatMap((s) => s.tags)])].sort();
  const knownCategories = [...new Set([...categories, ...state.flatMap((s) => s.category ?? [])])].sort((a, b) => a.localeCompare(b));
  const shownTags = knownTags.filter((tag) => tag.includes(needle));
  const shownCategories = knownCategories.filter((c) => c.toLowerCase().includes(needle));
  const newTag = needle !== "" && !knownTags.includes(needle);
  const newCategory = needle !== "" && !knownCategories.some((c) => c.toLowerCase() === needle);

  const toggleTag = (tag: string) => {
    const all = state.every((s) => s.tags.includes(tag));
    const next = state.map((s) => ({ ...s, tags: all ? s.tags.filter((x) => x !== tag) : s.tags.includes(tag) ? s.tags : [...s.tags, tag] }));
    setState(next);
    Promise.all(next.map((s) => api.setTags(s.id, s.tags))).then(onChanged, onError);
  };
  const setCategory = (category: string | null) => {
    setState(state.map((s) => ({ ...s, category })));
    Promise.all(state.map((s) => api.setCategory(s.id, category))).then(onChanged, onError);
  };
  const createTag = (e?: FormEvent) => {
    e?.preventDefault();
    if (!needle) return;
    toggleTag(needle);
    setText("");
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  };

  const tagMark = (tag: string) => {
    const n = state.filter((s) => s.tags.includes(tag)).length;
    return n === 0 ? null : n === state.length ? <Check size={12} /> : <Minus size={12} />;
  };
  const current = new Set(state.map((s) => s.category));
  const box = (mark: ReactNode, round = false) => (
    <span className={`flex h-[14px] w-[14px] shrink-0 items-center justify-center border ${round ? "rounded-full" : "rounded-[4px]"} ${mark ? "border-ui-accent bg-ui-accent text-ui-bg" : "border-ui-border-strong"}`}>{mark}</span>
  );

  const style = anchor
    ? {
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - WIDTH - 8)),
        ...(anchor.bottom + HEIGHT > window.innerHeight ? { bottom: window.innerHeight - anchor.top + 4 } : { top: anchor.bottom + 4 }),
      }
    : { left: (window.innerWidth - WIDTH) / 2, top: Math.max(8, (window.innerHeight - HEIGHT) / 2) };

  return (
    <>
      <button className="fixed inset-0 z-40 cursor-default" aria-label={t("common.close")} onClick={onClose} />
      <div role="dialog" aria-label={t("action.tags")} onKeyDown={onKey} style={{ ...style, width: WIDTH }} className="fixed z-50 flex max-h-[380px] flex-col overflow-hidden rounded-[10px] border border-ui-border-strong bg-ui-surface shadow-xl">
        <form onSubmit={createTag} className="flex items-center gap-[7px] border-b border-ui-border px-[10px] py-[8px]">
          <Search size={13} className="shrink-0 text-ui-text-3" />
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t("picker.filter")} aria-label={t("picker.filter")} className="min-w-0 flex-1 bg-transparent font-code text-[12px] text-ui-text placeholder:text-ui-text-3 focus:outline-none" />
          {torrents.length > 1 && <span className="shrink-0 font-code text-[10px] text-ui-text-3">{t("picker.count", { n: torrents.length })}</span>}
        </form>
        <div className="min-h-0 flex-1 overflow-y-auto py-[4px]">
          <div className={head}>{t("picker.tags")}</div>
          {shownTags.map((tag) => (
            <button key={tag} role="menuitemcheckbox" aria-checked={state.every((s) => s.tags.includes(tag))} className={row} onClick={() => toggleTag(tag)}>
              {box(tagMark(tag))}
              <Tag size={12} className="shrink-0 text-ui-text-3" />
              <span className="min-w-0 flex-1 truncate font-code">{tag}</span>
            </button>
          ))}
          {newTag && (
            <button className={`${row} text-ui-accent`} onClick={() => createTag()}>
              <Plus size={13} /> {t("picker.createTag", { name: needle })}
              <kbd className="ml-auto font-code text-[10px] text-ui-text-3">⏎</kbd>
            </button>
          )}
          {shownTags.length === 0 && !newTag && <div className="px-[10px] py-[6px] text-[11px] text-ui-text-3">{t("picker.noTags")}</div>}
          <div className={`${head} mt-[4px] border-t border-ui-border`}>{t("picker.category")}</div>
          {needle === "" && (
            <button role="menuitemradio" aria-checked={current.size === 1 && current.has(null)} className={row} onClick={() => setCategory(null)}>
              {box(current.size === 1 && current.has(null) ? <Check size={10} /> : null, true)}
              <span className="text-ui-text-3">{t("picker.noCategory")}</span>
            </button>
          )}
          {shownCategories.map((category) => {
            const on = current.size === 1 && current.has(category);
            return (
              <button key={category} role="menuitemradio" aria-checked={on} className={row} onClick={() => setCategory(on ? null : category)}>
                {box(on ? <Check size={10} /> : current.has(category) ? <Minus size={10} /> : null, true)}
                <Folder size={12} className="shrink-0 text-ui-amber" />
                <span className="min-w-0 flex-1 truncate">{category}</span>
              </button>
            );
          })}
          {newCategory && (
            <button
              className={`${row} text-ui-accent`}
              onClick={() => {
                setCategory(text.trim());
                setText("");
              }}
            >
              <Plus size={13} /> {t("picker.createCategory", { name: text.trim() })}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
