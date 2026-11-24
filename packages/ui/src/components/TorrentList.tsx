import { AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import type { Torrent } from "@torrentx/api-client";
import { chips, type Field, type Node, type ParseError, type SortKey } from "@torrentx/query";
import { useUi } from "../lib/context";
import { useActivity } from "../lib/hooks";
import { COLUMNS, SORT_FIELD, type Column } from "../lib/columns";
import { blame, NO_LENS, removeChip, type Lens } from "../lib/lens";
import { Chip } from "./Chip";
import { softButtonClass } from "./Modal";
import { TorrentRow, type TorrentAction } from "./TorrentRow";

interface TorrentListProps {
  /** Rows to show: tab query AND lens, already ordered by the query's `sort:`. */
  torrents: Torrent[];
  /** The whole library, for the activity graph and the zero-results breakdown. */
  all: Torrent[];
  /** Null when the tab query does not parse (`tabError` says why). */
  tabAst: Node | null;
  tabError: ParseError | null;
  tabQuery: string;
  fuzzy: Node | null;
  lensAst: Node | null;
  lens: Lens;
  onLens: (lens: Lens) => void;
  /** The leading sort key in effect. */
  sort?: SortKey;
  onSort: (field: Field) => void;
  compact: boolean;
  selectedTorrentId: string | null;
  onSelectTorrent: (id: string | null) => void;
  onAction: (torrent: Torrent, action: TorrentAction) => void;
  engineError: string | null;
  onOpenSettings: () => void;
}

const ASCII = `  _______                         _
 |__   __|                       | |
    | | ___  _ __ _ __ ___ _ __ | |_ ___
    | |/ _ \\| '__| '__/ _ \\ '_ \\| __/ __|
    | | (_) | |  | | |  __/ | | | |_\\__ \\
    |_|\\___/|_|  |_|  \\___|_| |_|\\__|___/
`;

/** Why the list is empty: never a bare "no results". */
function ZeroResults({ all, tabAst, tabError, tabQuery, fuzzy, lensAst, lens, onLens }: Pick<TorrentListProps, "all" | "tabAst" | "tabError" | "tabQuery" | "fuzzy" | "lensAst" | "lens" | "onLens">) {
  const { t } = useUi();
  if (tabError || !tabAst) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-red-400">
        <AlertTriangle size={18} />
        <p>{t("zero.badTab")}</p>
        <code className="break-all text-tx-accent-500">{tabQuery}</code>
        <p>
          {tabError?.message}
          {tabError?.suggestion && ` — ${t("filter.didYouMean", { suggestion: tabError.suggestion })}`}
        </p>
      </div>
    );
  }
  if (all.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center text-tx-accent-700">
        <pre className="mb-4 text-xs">{ASCII}</pre>
        <p>{t("list.empty")}</p>
      </div>
    );
  }
  const cause = blame(all, tabAst, fuzzy, lensAst);
  const lensChips = [...(fuzzy ? chips(fuzzy) : []), ...(lensAst ? chips(lensAst) : [])];
  const removeCause = () => {
    if (cause?.source === "fuzzy") onLens({ ...lens, fuzzy: "" });
    else if (cause?.source === "lens") onLens({ ...lens, query: removeChip(lens.query, cause.index) });
  };
  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-sm text-tx-accent-500">
      <p className="text-tx-accent-300">
        {cause ? t(cause.source === "tab" ? "zero.byTab" : "zero.byLens", { predicate: cause.text }) : t("zero.byCombination")}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
        <span className="text-tx-accent-700">{t("zero.tabQuery")}</span>
        {chips(tabAst).map((chip, i) => (
          <Chip key={i} chip={chip} status="default" />
        ))}
        {chips(tabAst).length === 0 && <span>{t("zero.everything")}</span>}
      </div>
      {lensChips.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs">
          <span className="text-tx-accent-700">{t("zero.lens")}</span>
          {lensChips.map((chip, i) => (
            <Chip key={i} chip={chip} />
          ))}
        </div>
      )}
      <div className="flex gap-2">
        {cause && cause.source !== "tab" && (
          <button className={softButtonClass} onClick={removeCause}>
            {t("zero.remove", { predicate: cause.text })}
          </button>
        )}
        {lensChips.length > 0 && (
          <button className={softButtonClass} onClick={() => onLens(NO_LENS)}>
            {t("zero.clearLens")}
          </button>
        )}
      </div>
    </div>
  );
}

export function TorrentList(props: TorrentListProps) {
  const { torrents, all, sort, onSort, compact, selectedTorrentId, onSelectTorrent, onAction, engineError, onOpenSettings } = props;
  const { t } = useUi();
  const activity = useActivity(all);

  return (
    <div className="flex-1 overflow-auto">
      {engineError && (
        <div className="flex items-center gap-3 px-4 py-2 bg-red-950/60 border-b border-red-900/60 text-sm text-red-300">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1 break-all">{engineError}</span>
          <button onClick={onOpenSettings} className="underline hover:text-red-100">
            {t("list.openSettings")}
          </button>
        </div>
      )}
      <div className="sticky top-0 z-10 px-4 py-2 border-b border-tx-accent-900/30 bg-tx-surface-950 flex text-[11px] text-tx-accent-600 font-semibold">
        {(Object.keys(COLUMNS) as Column[]).map((id) => (
          // Headers hold no sort state: a click only edits the `sort:` chip.
          <button key={id} onClick={() => onSort(SORT_FIELD[id])} className={`${COLUMNS[id]} hover:text-tx-accent-400 transition-colors`}>
            {t(`list.col.${id}`)}
            {sort?.field === SORT_FIELD[id] && (sort.desc ? <ChevronDown size={12} className="inline ml-1" /> : <ChevronUp size={12} className="inline ml-1" />)}
          </button>
        ))}
      </div>
      {!engineError && torrents.length === 0 ? (
        <ZeroResults {...props} />
      ) : (
        <div className="divide-y divide-tx-accent-900/20">
          {torrents.map((torrent) => (
            <TorrentRow
              key={torrent.id}
              torrent={torrent}
              compact={compact}
              isSelected={selectedTorrentId === torrent.id}
              onClick={() => onSelectTorrent(selectedTorrentId === torrent.id ? null : torrent.id)}
              onAction={(action) => onAction(torrent, action)}
              samples={activity.get(torrent.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
