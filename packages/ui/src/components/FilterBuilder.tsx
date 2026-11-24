import { useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import { defaultDesc, FIELD_NAMES, parse, STATES, type Field } from "@torrentx/query";
import { useUi } from "../lib/context";
import { builderText, opsFor, toBuilder, type Builder, type BuilderRow } from "../lib/lens";
import { primaryButtonClass, softButtonClass } from "./Modal";

interface FilterBuilderProps {
  /** The lens query the rows start from. */
  query: string;
  /** Live values offered for text fields (tags, trackers). */
  values: Partial<Record<Field, string[]>>;
  onApply: (query: string) => void;
  /** Applies, then opens the save confirmation. */
  onSaveAsTab: (query: string) => void;
  onClose: () => void;
}

const control =
  "bg-tx-surface-900 border border-tx-accent-900/50 rounded px-2 py-1 text-xs text-tx-accent-400 focus:outline-none focus:ring-1 focus:ring-tx-accent-700";
const OP_LABEL: Record<string, string> = { "=": "=", "!=": "≠", ">": ">", ">=": "≥", "<": "<", "<=": "≤" };

/** The lens as structured rows. It only produces query text, so it cannot disagree with typing. */
export function FilterBuilder({ query, values, onApply, onSaveAsTab, onClose }: FilterBuilderProps) {
  const { t } = useUi();
  const [builder, setBuilder] = useState<Builder>(() => {
    const initial = toBuilder(query);
    return initial.rows.length > 0 ? initial : { ...initial, rows: [{ field: "state", op: "=", value: "" }] };
  });
  const [copied, setCopied] = useState(false);

  const text = builderText(builder);
  const error = parse(text).error;

  const editRows = (key: "rows" | "group", edit: (rows: BuilderRow[]) => BuilderRow[]) =>
    setBuilder((b) => ({ ...b, [key]: edit(b[key]) }));
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  const rows = (key: "rows" | "group") =>
    builder[key].map((row, i) => {
      const patch = (change: Partial<BuilderRow>) =>
        editRows(key, (list) => list.map((r, j) => (j === i ? { ...r, ...change } : r)));
      const options = row.field === "state" ? STATES : values[row.field];
      const listId = `tx-builder-${key}-${i}`;
      return (
        <div key={i} className="flex items-center gap-2">
          <select
            aria-label={t("builder.field")}
            className={control}
            value={row.field}
            onChange={(e) => {
              const field = e.target.value as Field;
              patch({ field, op: opsFor(field).includes(row.op) ? row.op : "=" });
            }}
          >
            {FIELD_NAMES.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <select
            aria-label={t("builder.operator")}
            className={control}
            value={row.op}
            onChange={(e) => patch({ op: e.target.value as BuilderRow["op"] })}
          >
            {opsFor(row.field).map((op) => (
              <option key={op} value={op}>
                {OP_LABEL[op]}
              </option>
            ))}
          </select>
          <input
            aria-label={t("builder.value")}
            className={`${control} flex-1 min-w-0`}
            value={row.value}
            list={options ? listId : undefined}
            placeholder={t("builder.value")}
            onChange={(e) => patch({ value: e.target.value })}
          />
          {options && (
            <datalist id={listId}>
              {options.map((option) => (
                <option key={option} value={option} />
              ))}
            </datalist>
          )}
          <button
            type="button"
            aria-label={t("builder.removeRow")}
            className="text-tx-accent-700 hover:text-tx-accent-400"
            onClick={() => editRows(key, (list) => list.filter((_, j) => j !== i))}
          >
            <X size={12} />
          </button>
        </div>
      );
    });
  const addRow = (key: "rows" | "group", label: string) => (
    <button
      type="button"
      className="flex items-center gap-1 text-xs text-tx-accent-600 hover:text-tx-accent-400"
      onClick={() => editRows(key, (list) => [...list, { field: key === "group" ? "tracker" : "tag", op: "=", value: "" }])}
    >
      <Plus size={11} /> {label}
    </button>
  );

  return (
    <div
      role="dialog"
      aria-label={t("builder.title")}
      className="absolute left-3 top-full z-40 mt-1 w-[30rem] max-w-[calc(100vw-2rem)] space-y-3 rounded-md border border-tx-accent-900/50 bg-tx-surface-950 p-3 shadow-xl"
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div className="flex items-center gap-2 text-xs text-tx-accent-600">
        <span>{t("builder.match")}</span>
        <select
          aria-label={t("builder.match")}
          className={control}
          value={builder.join}
          onChange={(e) => setBuilder((b) => ({ ...b, join: e.target.value as Builder["join"] }))}
        >
          <option value="all">{t("builder.all")}</option>
          <option value="any">{t("builder.any")}</option>
        </select>
      </div>
      <div className="space-y-2">
        {rows("rows")}
        {addRow("rows", t("builder.addRow"))}
      </div>
      <div className="space-y-2 border-l-2 border-tx-accent-900/50 pl-3">
        <div className="text-xs text-tx-accent-600">{t("builder.orGroup")}</div>
        {rows("group")}
        {addRow("group", t("builder.addOr"))}
      </div>
      <div className="flex items-center gap-2 text-xs text-tx-accent-600">
        <span>{t("builder.sort")}</span>
        <select
          aria-label={t("builder.sort")}
          className={control}
          value={builder.sort?.field ?? ""}
          onChange={(e) => {
            const field = e.target.value as Field | "";
            setBuilder((b) => ({ ...b, sort: field ? { field, desc: defaultDesc(field) } : null }));
          }}
        >
          <option value="">{t("builder.noSort")}</option>
          {FIELD_NAMES.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        {builder.sort && (
          <select
            aria-label={t("builder.direction")}
            className={control}
            value={builder.sort.desc ? "desc" : "asc"}
            onChange={(e) => setBuilder((b) => ({ ...b, sort: b.sort && { ...b.sort, desc: e.target.value === "desc" } }))}
          >
            <option>asc</option>
            <option>desc</option>
          </select>
        )}
      </div>
      {builder.raw.length > 0 && (
        <div className="text-xs text-tx-accent-700">{t("builder.kept", { text: builder.raw.join(" ") })}</div>
      )}
      <div className="flex items-start gap-2 rounded bg-tx-surface-900 px-2 py-1.5 text-xs">
        <code className="flex-1 break-all text-tx-accent-300">{text || t("builder.empty")}</code>
        <button type="button" onClick={copy} title={t("builder.copy")} className="text-tx-accent-600 hover:text-tx-accent-400">
          <Copy size={12} />
        </button>
        {copied && <span className="text-tx-accent-600">{t("builder.copied")}</span>}
      </div>
      {error && (
        <p className="text-xs text-red-400">
          {error.message}
          {error.suggestion && ` — ${t("filter.didYouMean", { suggestion: error.suggestion })}`}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className={softButtonClass} disabled={!!error || !text} onClick={() => onSaveAsTab(text)}>
          {t("filter.saveAsTab")}
        </button>
        <button type="button" className={primaryButtonClass} disabled={!!error} onClick={() => onApply(text)}>
          {t("builder.apply")}
        </button>
      </div>
    </div>
  );
}
