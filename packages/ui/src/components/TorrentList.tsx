import { useRef, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { AlertTriangle, Check, Funnel, FunnelX, Search, TriangleAlert, Undo2, Columns3Cog } from "lucide-react";
import type { Torrent } from "@torrentx/api-client";
import { chips, evaluate, type Field, type Node, type ParseError, type SortKey } from "@torrentx/query";
import { useUi } from "../lib/context";
import { useActivity } from "../lib/hooks";
import { bytes } from "../lib/format";
import { clampWidth, COLUMNS, resizeTarget, SORT_FIELD, type Column, type ColumnWidths } from "../lib/columns";
import { ColumnsMenu } from "./ColumnsMenu";
import { COMMANDS } from "../lib/commands";
import { IS_MAC, keyCaps } from "../lib/keymap";
import { blame, hasLens, NO_LENS, removeChip, scopeOf, type Lens } from "../lib/lens";
import { Chip } from "./Chip";
import { TorrentRow } from "./TorrentRow";
import type { TorrentAction } from "../lib/commands";

interface TorrentListProps {
  /** Left-to-right column order (header and rows). */
  columns: Column[];
  onColumns: (order: Column[]) => void;
  widths: ColumnWidths;
  onWidths: (widths: ColumnWidths) => void;
  columnsOpen: boolean;
  onColumnsOpen: (open: boolean) => void;
  /** Rows to show: tab query AND lens, already ordered by the query's `sort:`. */
  torrents: Torrent[];
  /** The whole library, for the activity graph and the zero-results breakdown. */
  all: Torrent[];
  /** Null when the tab query does not parse (`tabError` says why). */
  tabAst: Node | null;
  tabError: ParseError | null;
  tabQuery: string;
  tabName: string;
  fuzzy: Node | null;
  lensAst: Node | null;
  lens: Lens;
  onLens: (lens: Lens) => void;
  onOpenBuilder: () => void;
  onSearchAll: () => void;
  /** The leading sort key in effect. */
  sort?: SortKey;
  onSort: (field: Field) => void;
  compact: boolean;
  selection: Set<string>;
  cursor: string | null;
  onRowClick: (id: string, e: MouseEvent) => void;
  onRowOpen: (id: string) => void;
  /** Keys while the list has focus: row cursor, Space, ⏎ (the registry's local list commands). */
  onListKey: (e: KeyboardEvent) => void;
  onAction: (torrent: Torrent, action: TorrentAction) => void;
  engineError: string | null;
  onOpenSettings: () => void;
}

const button = "flex items-center gap-[7px] rounded-[9px] border px-[13px] py-[9px] text-[12px]";
const secondary = `${button} border-ui-border-strong bg-ui-surface-2 font-medium text-ui-text hover:border-ui-text-3`;
const primary = `${button} border-ui-accent bg-ui-accent font-semibold text-ui-bg hover:opacity-90`;

/** The first key of a registered command, drawn as key caps. */
function CommandKeys({ id, tone }: { id: string; tone: string }) {
  const binding = COMMANDS.find((c) => c.id === id)?.keys[0];
  return binding ? <span className={`font-code text-[10px] font-normal ${tone}`}>{keyCaps(binding, IS_MAC).join(IS_MAC ? "" : "+")}</span> : null;
}

function EmptyFrame({ icon, title, sub, children }: { icon: ReactNode; title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex w-full flex-col items-center gap-[16px] px-[40px] py-[70px]">
      <div className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-[16px] border border-ui-border bg-ui-surface-2 text-ui-text-2">{icon}</div>
      <div className="text-[17px] font-semibold text-ui-text">{title}</div>
      {sub && <p className="max-w-[460px] text-center text-[12px] leading-[18px] text-ui-text-2">{sub}</p>}
      {children}
    </div>
  );
}

/** Why the list is empty: never a bare "no results". */
function ZeroResults(props: TorrentListProps) {
  const { all, tabAst, tabError, tabQuery, tabName, fuzzy, lensAst, lens, onLens, onOpenBuilder, onSearchAll } = props;
  const { t } = useUi();
  if (tabError || !tabAst) {
    return (
      <EmptyFrame icon={<AlertTriangle size={24} className="text-ui-red" />} title={t("zero.badTab")}>
        <code className="max-w-[560px] break-all rounded-[8px] border border-ui-border bg-ui-surface-2 px-[10px] py-[6px] font-code text-[11px] text-ui-text">{tabQuery}</code>
        <p className="font-code text-[11px] text-ui-red">
          {tabError?.message}
          {tabError?.suggestion && ` — ${t("filter.didYouMean", { suggestion: tabError.suggestion })}`}
        </p>
      </EmptyFrame>
    );
  }
  if (all.length === 0) {
    return <EmptyFrame icon={<Search size={24} />} title={t("list.empty")} />;
  }
  const now = Date.now() / 1000;
  const inTab = all.filter((row) => evaluate(tabAst, row, now));
  const cause = blame(all, tabAst, fuzzy, lensAst, now);
  const lensChips = [...(fuzzy ? chips(fuzzy) : []), ...(lensAst ? chips(lensAst) : [])];
  const removeCause = () => {
    if (cause?.source === "fuzzy") onLens({ ...lens, fuzzy: "" });
    else if (cause?.source === "lens") onLens({ ...lens, query: removeChip(lens.query, cause.index) });
  };
  // "largest match is 42.1 GB" style hint for a size predicate.
  const largest = cause && cause.text.startsWith("size:") && inTab.length > 0 ? Math.max(...inTab.map((row) => row.size)) : null;
  const tabChips = chips(tabAst);
  const scope = scopeOf(lens, tabQuery);
  // Removing a tab chip edits this visit's copy of the tab query; the saved tab never changes.
  const removeTabChip = (i: number) => onLens({ ...lens, scope: removeChip(scope, i) });
  const removeLensChip = (i: number) => {
    if (fuzzy && i === 0) onLens({ ...lens, fuzzy: "" });
    else onLens({ ...lens, query: removeChip(lens.query, fuzzy ? i - 1 : i) });
  };
  const label = "whitespace-nowrap font-code text-[10px] tracking-[1px]";
  const count = "shrink-0 whitespace-nowrap font-code text-[10px]";

  return (
    <EmptyFrame icon={<FunnelX size={24} className="text-ui-amber" />} title={t(cause?.source === "tab" ? "zero.titleTab" : "zero.title")} sub={t(cause?.source === "tab" ? "zero.subTab" : "zero.sub")}>
      <div className="w-full max-w-[560px] overflow-hidden rounded-[12px] border border-ui-border bg-ui-surface-2">
        <div className="flex items-center gap-[10px] border-b border-ui-border px-[13px] py-[11px]">
          <div className="flex w-[94px] shrink-0 flex-col gap-[2px]">
            <span className={`${label} truncate text-ui-text-2`}>{t("zero.tabLabel", { tab: tabName })}</span>
            <span className="font-code text-[9px] text-ui-text-3">{t("zero.tabDesc")}</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[5px]">
            {tabChips.map((chip, i) => (
              <Chip key={i} chip={chip} status="default" icon={Funnel} onRemove={() => removeTabChip(i)} />
            ))}
            {tabChips.length === 0 && <span className="font-code text-[11px] text-ui-text-3">{t("zero.everything")}</span>}
          </div>
          <span className={`${count} ${inTab.length === 0 ? "text-ui-amber" : "text-ui-text-2"}`}>{t("zero.matches", { n: inTab.length })}</span>
        </div>
        {lensChips.length > 0 && (
          <div className="flex items-center gap-[10px] border-b border-ui-border px-[13px] py-[11px]">
            <div className="flex w-[94px] shrink-0 flex-col gap-[2px]">
              <span className={`${label} text-ui-amber`}>{t("zero.lensLabel")}</span>
              <span className="font-code text-[9px] text-ui-text-3">{t("zero.lensDesc")}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[5px]">
              {lensChips.map((chip, i) => (
                <Chip key={i} chip={chip} icon={Check} onRemove={() => removeLensChip(i)} />
              ))}
            </div>
            <span className={`${count} text-ui-amber`}>{t("zero.matches", { n: 0 })}</span>
          </div>
        )}
        <div className="flex items-center gap-[8px] bg-ui-amber-soft px-[13px] py-[10px] font-code text-[10px] text-ui-amber">
          <TriangleAlert size={12} className="shrink-0" />
          <span className="flex-1">
            {cause
              ? largest !== null
                ? t("zero.culpritLargest", { predicate: cause.text, size: bytes(largest) })
                : t("zero.culprit", { predicate: cause.text })
              : t("zero.byCombination")}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-[8px]">
        {hasLens(lens) && (
          <button data-command="lens.clear" className={primary} onClick={() => onLens(NO_LENS)}>
            <FunnelX size={13} /> {t("zero.clearLens")}
            <CommandKeys id="lens.clear" tone="text-ui-bg" />
          </button>
        )}
        {cause && cause.source !== "tab" && (
          <button className={secondary} onClick={removeCause}>
            <Undo2 size={13} /> {t("zero.remove", { predicate: cause.text })}
            <CommandKeys id="lens.undo" tone="text-ui-text-3" />
          </button>
        )}
        <button data-command="builder.open" className={secondary} onClick={onOpenBuilder}>
          <Funnel size={13} /> {t("zero.edit")}
          <CommandKeys id="builder.open" tone="text-ui-text-3" />
        </button>
        <button className={secondary} onClick={onSearchAll}>
          <Search size={13} /> {t("zero.searchAll")}
          <CommandKeys id="palette.open" tone="text-ui-text-3" />
        </button>
      </div>
      <p className="max-w-[560px] text-center font-code text-[10px] text-ui-text-3">{t("zero.rule")}</p>
    </EmptyFrame>
  );
}

export function TorrentList(props: TorrentListProps) {
  const { torrents, all, sort, onSort, compact, selection, cursor, onRowClick, onRowOpen, onListKey, onAction, engineError, onOpenSettings, columns, onColumns, widths, onWidths, columnsOpen, onColumnsOpen } = props;
  const headerRef = useRef<HTMLDivElement>(null);
  const startResize = (e: ReactPointerEvent, left: Column) => {
    const target = resizeTarget(columns, left);
    const cell = target && headerRef.current?.querySelector<HTMLElement>(`[data-col="${target.column}"]`);
    if (!target || !cell) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    const start = cell.offsetWidth;
    const move = (ev: PointerEvent) => onWidths({ ...widths, [target.column]: clampWidth(start + target.sign * (ev.clientX - startX)) });
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };
  const resetWidth = (left: Column) => {
    const target = resizeTarget(columns, left);
    if (target) onWidths(Object.fromEntries(Object.entries(widths).filter(([c]) => c !== target.column)));
  };
  const { t } = useUi();
  const activity = useActivity(all);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {engineError && (
        <div className="flex items-center gap-[10px] border-b border-ui-border bg-ui-red-soft px-[16px] py-[8px] text-[12px] text-ui-red">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1 break-all">{engineError}</span>
          <button onClick={onOpenSettings} className="underline">
            {t("list.openSettings")}
          </button>
        </div>
      )}
      <div ref={headerRef} className="relative flex shrink-0 items-center gap-[10px] border-b border-ui-border px-[16px] py-[9px] font-code text-[9px] tracking-[1px] text-ui-text-3">
        <span className="w-[7px] shrink-0" />
        {columns.map((id) => (
          // Headers hold no sort state: a click only edits the `sort:` chip.
          <button
            key={id}
            data-col={id}
            onClick={() => onSort(SORT_FIELD[id])}
            style={widths[id] ? { width: widths[id] } : undefined}
            className={`${COLUMNS[id]} relative uppercase hover:text-ui-text-2 ${sort?.field === SORT_FIELD[id] ? "text-ui-cyan" : ""}`}
          >
            {t(`list.col.${id}`)}
            {sort?.field === SORT_FIELD[id] && (sort.desc ? " ↓" : " ↑")}
            {resizeTarget(columns, id) && (
              // The border to the right: drag to resize, double-click for the default width.
              <span
                role="separator"
                aria-orientation="vertical"
                title={t("columns.resize")}
                onPointerDown={(e) => startResize(e, id)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  resetWidth(id);
                }}
                className="absolute -right-[8px] top-[-9px] bottom-[-9px] z-10 w-[6px] cursor-col-resize rounded-[2px] hover:bg-ui-accent-line active:bg-ui-accent"
              />
            )}
          </button>
        ))}
        <button
          data-command="columns.edit"
          className="absolute right-[4px] rounded-[5px] p-[2px] text-ui-text-3 hover:bg-ui-surface-2 hover:text-ui-text"
          title={t("columns.title")}
          aria-expanded={columnsOpen}
          onClick={() => onColumnsOpen(!columnsOpen)}
        >
          <Columns3Cog size={12} />
        </button>
        {columnsOpen && <ColumnsMenu order={columns} onOrder={onColumns} widths={widths} onWidths={onWidths} onClose={() => onColumnsOpen(false)} />}
      </div>
      <div id="tx-list" className="min-h-0 flex-1 overflow-y-auto focus:outline-none" tabIndex={0} onKeyDown={onListKey} aria-label={t("list.label")}>
        {!engineError && torrents.length === 0 ? (
          <ZeroResults {...props} />
        ) : (
          <div className="flex flex-col gap-[2px] px-[6px] py-[6px]">
            {torrents.map((torrent) => (
              <TorrentRow
                key={torrent.id}
                torrent={torrent}
                compact={compact}
                isSelected={selection.has(torrent.id)}
                isCursor={cursor === torrent.id}
                onClick={(e) => onRowClick(torrent.id, e)}
                onDoubleClick={() => onRowOpen(torrent.id)}
                onAction={(action) => onAction(torrent, action)}
                samples={activity.get(torrent.id)}
                order={columns}
                widths={widths}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
