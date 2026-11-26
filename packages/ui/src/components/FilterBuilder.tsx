import { useState, type ReactNode } from "react";
import { ArrowDownUp, ChevronDown, Copy, Funnel, GripVertical, Plus, Save, X } from "lucide-react";
import type { Torrent } from "@torrentx/api-client";
import { defaultDesc, evaluate, FIELD_NAMES, parse, STATES, type Field } from "@torrentx/query";
import { useUi } from "../lib/context";
import { builderText, opsFor, toBuilder, type Builder, type BuilderRow } from "../lib/lens";

interface FilterBuilderProps {
  /** The lens query the rows start from. */
  query: string;
  tabName: string;
  /** The library, for the per-row match hints. */
  all: Torrent[];
  /** Live values offered for text fields (tags, trackers). */
  values: Partial<Record<Field, string[]>>;
  onApply: (query: string) => void;
  /** Applies, then opens the save confirmation. */
  /** Null on a tab the user made: Apply already saves it. */
  onSaveAsTab: ((query: string) => void) | null;
  onClose: () => void;
}

const box = "relative flex items-center rounded-[7px] border bg-ui-surface-2 font-code text-[11px]";

/** A native select dressed as the canvas dropdown: value text + chevron. */
function Select({ value, onChange, label, width, tone = "text-ui-text", children }: { value: string; onChange: (v: string) => void; label: string; width: string; tone?: string; children: ReactNode }) {
  return (
    <div className={`${box} ${width} border-ui-border`}>
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`w-full cursor-pointer appearance-none bg-transparent py-[6px] pl-[8px] pr-[22px] focus:outline-none ${tone}`}>
        {children}
      </select>
      <ChevronDown size={10} className="pointer-events-none absolute right-[8px] text-ui-text-3" />
    </div>
  );
}

const rowText = (row: BuilderRow) => builderText({ join: "all", rows: [row], group: [], sort: null, raw: [] });

/** The lens as structured rows. It only produces query text, so it cannot disagree with typing. */
export function FilterBuilder({ query, tabName, all, values, onApply, onSaveAsTab, onClose }: FilterBuilderProps) {
  const { t } = useUi();
  const fresh = (): Builder => ({ join: "all", rows: [{ field: "state", op: "=", value: "" }], group: [], sort: null, raw: [] });
  const [builder, setBuilder] = useState<Builder>(() => {
    const initial = toBuilder(query);
    return initial.rows.length > 0 || initial.group.length > 0 ? initial : { ...initial, rows: fresh().rows };
  });
  const [copied, setCopied] = useState(false);

  const text = builderText(builder);
  const error = parse(text).error;
  const now = Date.now() / 1000;
  const opLabel: Record<string, string> = { "=": t("builder.is"), "!=": t("builder.isNot"), ">": ">", ">=": "≥", "<": "<", "<=": "≤" };

  const editRows = (key: "rows" | "group", edit: (rows: BuilderRow[]) => BuilderRow[]) => setBuilder((b) => ({ ...b, [key]: edit(b[key]) }));
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };
  /** "41 torrents": how many in the library match this row alone. */
  const hint = (row: BuilderRow) => {
    if (!row.value.trim()) return row.field === "state" ? t("builder.states", { n: STATES.length }) : "";
    const ast = parse(rowText(row)).ast;
    return ast ? t("builder.hint", { n: all.filter((r) => evaluate(ast, r, now)).length }) : "!";
  };

  const rows = (key: "rows" | "group") =>
    builder[key].map((row, i) => {
      const patch = (change: Partial<BuilderRow>) => editRows(key, (list) => list.map((r, j) => (j === i ? { ...r, ...change } : r)));
      const options = row.field === "state" ? STATES : values[row.field];
      const listId = `tx-builder-${key}-${i}`;
      const bad = row.value.trim() !== "" && parse(rowText(row)).error;
      return (
        <div key={i} className="flex w-full items-center gap-[6px]">
          <GripVertical size={12} className="shrink-0 text-ui-text-3" />
          <Select
            label={t("builder.field")}
            width="w-[110px]"
            value={row.field}
            onChange={(v) => {
              const field = v as Field;
              patch({ field, op: opsFor(field).includes(row.op) ? row.op : "=" });
            }}
          >
            {FIELD_NAMES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
          <Select label={t("builder.operator")} width="w-[74px]" tone="text-ui-text-2" value={row.op} onChange={(v) => patch({ op: v as BuilderRow["op"] })}>
            {opsFor(row.field).map((op) => (
              <option key={op} value={op}>
                {opLabel[op]}
              </option>
            ))}
          </Select>
          <div className={`${box} min-w-0 flex-1 gap-[6px] px-[8px] ${bad ? "border-ui-red" : "border-ui-accent-line"}`}>
            <input
              aria-label={t("builder.value")}
              className="min-w-0 flex-1 bg-transparent py-[6px] text-ui-accent placeholder-ui-text-3 focus:outline-none"
              value={row.value}
              list={options ? listId : undefined}
              placeholder={t("builder.value")}
              onChange={(e) => patch({ value: e.target.value })}
            />
            <span className="shrink-0 text-[9px] text-ui-text-3">{hint(row)}</span>
          </div>
          {options && (
            <datalist id={listId}>
              {options.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
          <button type="button" aria-label={t("builder.removeRow")} className="text-ui-text-3 hover:text-ui-red" onClick={() => editRows(key, (list) => list.filter((_, j) => j !== i))}>
            <X size={13} />
          </button>
        </div>
      );
    });

  const dashed = "flex items-center gap-[5px] rounded-[7px] border border-dashed border-ui-border-strong px-[9px] py-[6px] text-[11px] text-ui-text-3 hover:text-ui-text-2";
  const hasGroup = builder.group.length > 0;

  return (
    <div
      role="dialog"
      aria-label={t("builder.title")}
      className="absolute left-[14px] top-full z-40 mt-[6px] flex w-[470px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[14px] border border-ui-border-strong bg-ui-surface font-ui shadow-[0_18px_44px_rgba(0,0,0,0.66)]"
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        else if (e.key === "Enter" && !error && !(e.target instanceof HTMLSelectElement)) onApply(text);
      }}
    >
      <div className="flex items-center gap-[8px] border-b border-ui-border px-[14px] py-[12px]">
        <Funnel size={14} className="text-ui-accent" />
        <span className="text-[13px] font-semibold text-ui-text">{t("builder.title")}</span>
        <span className="flex items-center gap-[5px] rounded-[6px] bg-ui-surface-2 px-[7px] py-[3px] font-code text-[10px] text-ui-text-2">{t("builder.scope", { tab: tabName })}</span>
        <span className="flex-1" />
        <button type="button" aria-label={t("common.close")} onClick={onClose} className="text-ui-text-3 hover:text-ui-text">
          <X size={14} />
        </button>
      </div>
      <div className="flex max-h-[60vh] flex-col gap-[8px] overflow-y-auto p-[14px]">
        <div className="flex items-center gap-[7px] text-[12px] text-ui-text-2">
          <span>{t("builder.match")}</span>
          <Select label={t("builder.match")} width="w-[120px]" tone="text-ui-accent" value={builder.join} onChange={(v) => setBuilder((b) => ({ ...b, join: v as Builder["join"] }))}>
            <option value="all">{t("builder.all")}</option>
            <option value="any">{t("builder.any")}</option>
          </Select>
          <span>{t("builder.matchSuffix")}</span>
        </div>
        {rows("rows")}
        {hasGroup && (
          <div className="flex flex-col gap-[7px] rounded-[9px] border border-ui-border bg-ui-chrome-2 p-[10px]">
            <div className="flex items-center gap-[7px] text-[11px] text-ui-text-2">
              <span>{t("builder.andMatch")}</span>
              <span className={`${box} w-[110px] border-ui-border px-[8px] py-[6px] text-ui-cyan`}>{t("builder.any")}</span>
              <span className="flex-1" />
              <button type="button" aria-label={t("builder.removeGroup")} className="text-ui-text-3 hover:text-ui-red" onClick={() => setBuilder((b) => ({ ...b, group: [] }))}>
                <X size={13} />
              </button>
            </div>
            {rows("group")}
            <button type="button" className={`${dashed} self-start`} onClick={() => editRows("group", (list) => [...list, { field: "tracker", op: "=", value: "" }])}>
              <Plus size={11} /> {t("builder.addRow")}
            </button>
          </div>
        )}
        <div className="flex items-center gap-[8px]">
          <button type="button" className={dashed} onClick={() => editRows("rows", (list) => [...list, { field: "tag", op: "=", value: "" }])}>
            <Plus size={11} /> {t("builder.addRow")}
          </button>
          {!hasGroup && (
            <button type="button" className={dashed} onClick={() => setBuilder((b) => ({ ...b, group: [{ field: "tracker", op: "=", value: "" }] }))}>
              <Plus size={11} /> {t("builder.addGroup")}
            </button>
          )}
        </div>
        <div className="h-px w-full bg-ui-border" />
        <div className="flex items-center gap-[7px] text-[12px] text-ui-text-2">
          <ArrowDownUp size={13} className="text-ui-cyan" />
          <span>{t("builder.sort")}</span>
          <Select
            label={t("builder.sort")}
            width="w-[120px]"
            tone="text-ui-cyan"
            value={builder.sort?.field ?? ""}
            onChange={(v) => {
              const field = v as Field | "";
              setBuilder((b) => ({ ...b, sort: field ? { field, desc: defaultDesc(field) } : null }));
            }}
          >
            <option value="">{t("builder.noSort")}</option>
            {FIELD_NAMES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </Select>
          {builder.sort && (
            <Select label={t("builder.direction")} width="w-[90px]" tone="text-ui-cyan" value={builder.sort.desc ? "desc" : "asc"} onChange={(v) => setBuilder((b) => ({ ...b, sort: b.sort && { ...b.sort, desc: v === "desc" } }))}>
              <option>asc</option>
              <option>desc</option>
            </Select>
          )}
          <span className="flex-1 font-code text-[9px] text-ui-text-3">{t("builder.sortNote")}</span>
        </div>
        {builder.raw.length > 0 && <div className="font-code text-[10px] text-ui-text-3">{t("builder.kept", { text: builder.raw.join(" ") })}</div>}
      </div>
      <div className="flex items-start gap-[8px] border-y border-ui-border bg-ui-chrome-2 px-[14px] py-[10px]">
        <code className={`flex-1 break-all font-code text-[10px] leading-[15px] ${error ? "text-ui-red" : "text-ui-accent"}`}>
          {error ? `${error.message}${error.suggestion ? ` — ${t("filter.didYouMean", { suggestion: error.suggestion })}` : ""}` : text || t("builder.empty")}
        </code>
        <button type="button" onClick={copy} title={copied ? t("builder.copied") : t("builder.copy")} className={copied ? "text-ui-accent" : "text-ui-text-3 hover:text-ui-text"}>
          <Copy size={13} />
        </button>
      </div>
      <div className="flex items-center gap-[8px] px-[14px] py-[12px]">
        <button type="button" className="text-[12px] text-ui-text-3 hover:text-ui-text" onClick={() => setBuilder(fresh())}>
          {t("builder.reset")}
        </button>
        <span className="flex-1" />
        {onSaveAsTab && (
        <button type="button" disabled={!!error || !text} onClick={() => onSaveAsTab(text)} className="flex items-center gap-[6px] rounded-[8px] border border-ui-border-strong px-[12px] py-[8px] text-[12px] font-medium text-ui-text-2 hover:text-ui-text disabled:opacity-40">
          <Save size={12} /> {t("filter.saveAsTab")}
        </button>
        )}
        <button type="button" disabled={!!error} onClick={() => onApply(text)} className="flex items-center gap-[6px] rounded-[8px] bg-ui-accent px-[14px] py-[8px] text-[12px] font-semibold text-ui-bg hover:opacity-90 disabled:opacity-40">
          {onSaveAsTab ? t("builder.apply") : t("save.confirm")} <kbd className="font-code text-[10px] font-normal">⏎</kbd>
        </button>
      </div>
    </div>
  );
}
