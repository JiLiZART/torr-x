import { useState } from "react";
import { CheckCircle, Disc3, Edit3, Ellipsis, FileText, Film, Folder, FolderInput, FolderOpen, ImageOff, Link2, Pause, Play, Plus, Save, Tag, Trash, Trash2 } from "lucide-react";
import { api, type TorrentDetails } from "@torrentx/api-client";
import { useUi } from "../../lib/context";
import { age, bytes, duration, percent, rate, rowState, STATE_STYLE } from "../../lib/format";
import { COMMAND_FOR_ACTION, type TorrentAction } from "../../lib/commands";
import { extOf, fileClass, swarm } from "../../lib/detail";

interface HeroProps {
  d: TorrentDetails;
  /** Recent down rates, oldest first: the bar graph. */
  history: number[];
  onAction: (action: TorrentAction) => void;
}

const button = "flex items-center gap-[7px] rounded-[9px] border px-[13px] py-[9px] text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-40";
const quiet = `${button} border-ui-border-strong bg-ui-surface-2 text-ui-text hover:border-ui-text-3`;
/** As many as `HISTORY` in `DetailPage`. */
const BARS = 96;
const chip = "flex items-center gap-[4px] rounded-[6px] border border-ui-border bg-ui-surface-2 px-[7px] py-[2px] font-code text-[10px]";

/** The torrent's state at a glance: what it is, what it is doing, and the actions that change that. */
export function Hero({ d, history, onAction }: HeroProps) {
  const { t, gate } = useUi();
  const [menu, setMenu] = useState(false);
  const state = rowState(d);
  const style = STATE_STYLE[state];
  const paused = d.status === "paused";
  const known = swarm(d.trackers);
  // The format icon follows the largest file.
  const largest = [...d.files].sort((a, b) => b.size - a.size)[0];
  const kind = largest ? fileClass(extOf(largest.path)) : "other";
  const Icon = kind === "video" ? Film : kind === "disc" ? Disc3 : FileText;
  const of = (have: number, total: number | null) => (total === null ? String(have) : t("detail.of", { n: have, m: total }));
  const stats: [string, string, string?][] = [
    [percent(d.progress), t("detail.stat.progress"), "text-ui-accent"],
    [t("detail.transferred", { have: bytes(d.size * d.progress), total: bytes(d.size) }), t("detail.stat.transferred")],
    [d.progress >= 1 ? "—" : d.etaSecs == null ? "∞" : duration(d.etaSecs), t("detail.stat.eta")],
    [`↓ ${rate(d.downloadRate).trim()}`, t("detail.stat.down"), "text-ui-accent"],
    [`↑ ${rate(d.uploadRate).trim()}`, t("detail.stat.up"), "text-ui-cyan"],
    [of(d.seeds, known.seeds), t("detail.stat.seeds"), "text-ui-text-2"],
    [of(d.peers, known.leechers), t("detail.stat.peers"), "text-ui-text-2"],
    [d.ratio == null ? "—" : d.ratio.toFixed(2), t("detail.stat.ratio"), "text-ui-text-2"],
  ];
  const peak = Math.max(...history, 1);
  const bars = [...Array(Math.max(BARS - history.length, 0)).fill(0), ...history.slice(-BARS)];
  const menuItem = "flex w-full items-center gap-[8px] px-[10px] py-[6px] text-left text-[12px] text-ui-text-2 hover:bg-ui-surface-2 hover:text-ui-text disabled:opacity-40";
  const act = (action: TorrentAction) => {
    setMenu(false);
    onAction(action);
  };

  // `isolate` keeps the cover behind the content; with the menu open the hero rises over the sticky section tabs.
  return (
    <section className={`relative isolate flex shrink-0 flex-col gap-[14px] border-b border-ui-border bg-ui-surface px-[18px] py-[16px] ${menu ? "z-20" : ""}`}>
      {d.cover && (
        // The cover, dimmed with the surface token so text keeps its contrast in both themes.
        <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
          <img src={api.coverUrl(d.id, d.cover)} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-ui-surface via-ui-surface/90 to-ui-surface/75" />
        </div>
      )}
      <div className="flex items-center gap-[14px]">
        <span className="flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-[12px] border border-ui-border bg-ui-surface-2 text-ui-text-2">
          <Icon size={24} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
          <h2 className="truncate text-[18px] font-semibold text-ui-text" title={d.name}>
            {d.name}
          </h2>
          <div className="flex flex-wrap items-center gap-[9px] font-code text-[10px] text-ui-text-3">
            <span className={`flex items-center gap-[5px] rounded-[6px] px-[8px] py-[3px] ${style.badge}`}>
              <span className={`h-[6px] w-[6px] rounded-full ${style.dot}`} /> {t(`state.${state}`)}
            </span>
            <span>{bytes(d.size)}</span>
            <span>{t("addflow.files", { n: d.files.length })}</span>
            {d.tracker && <span>{d.tracker}</span>}
            <span>{t("row.added", { when: age(d.addedAt) })}</span>
            <span title={d.id}>btih {d.id.slice(0, 6)}…{d.id.slice(-4)}</span>
            <span className="truncate" title={d.savePath}>
              {d.savePath}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-[5px]">
            {d.category && (
              <button className={`${chip} text-ui-amber`} onClick={() => onAction("tags")}>
                <Folder size={10} /> {d.category}
              </button>
            )}
            {d.tags.map((tag) => (
              <button key={tag} className={`${chip} text-ui-text-2`} onClick={() => onAction("tags")}>
                <Tag size={10} /> {tag}
              </button>
            ))}
            <button data-tags-anchor={d.id} data-command="sel.tags" className={`${chip} border-dashed text-ui-text-3 hover:text-ui-text-2`} onClick={() => onAction("tags")}>
              <Plus size={10} /> {d.category || d.tags.length > 0 ? t("picker.edit") : t("action.tags")}
            </button>
          </div>
          {d.error && <p className="font-code text-[11px] text-ui-red">{d.error}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-[7px]">
          <button data-command={paused ? "sel.resume" : "sel.pause"} className={`${button} border-ui-accent bg-ui-accent text-ui-bg hover:opacity-90`} onClick={() => onAction(paused ? "resume" : "pause")}>
            {paused ? <Play size={14} /> : <Pause size={14} />} {t(paused ? "action.resume" : "action.pause")}
          </button>
          <button data-command="sel.verify" className={quiet} disabled={!!gate("verify")} title={gate("verify")} onClick={() => onAction("verify")}>
            <CheckCircle size={14} /> {t("detail.verify")}
          </button>
          <button data-command="sel.reveal" className={quiet} onClick={() => onAction("reveal")}>
            <FolderOpen size={14} /> {t("detail.reveal")}
          </button>
          <button data-command="sel.remove" className={`${button} border-ui-red bg-ui-red-soft text-ui-red hover:bg-ui-red/20`} onClick={() => onAction("remove")}>
            <Trash2 size={14} /> {t("action.remove")}
          </button>
          <div className="relative">
            <button className={`${quiet} !px-[9px]`} aria-label={t("detail.more")} aria-expanded={menu} onClick={() => setMenu(!menu)}>
              <Ellipsis size={14} />
            </button>
            {menu && (
              <>
                <button className="fixed inset-0 z-40 cursor-default" aria-label={t("common.close")} onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-full z-50 mt-[4px] w-[240px] overflow-hidden rounded-[10px] border border-ui-border-strong bg-ui-surface py-[4px] shadow-xl">
                  {(
                    [
                      ["tags", Tag, undefined],
                      ["rename", Edit3, gate("rename")],
                      ["relocate", FolderInput, gate("relocate")],
                      ["torrentFile", Save, gate("torrentFile")],
                      ["magnet", Link2, undefined],
                      ...(d.cover ? [["removeCover", ImageOff, undefined] as const] : []),
                      ["erase", Trash, undefined],
                    ] as const
                  ).map(([action, ItemIcon, hint]) => (
                    <button key={action} data-command={COMMAND_FOR_ACTION[action]} className={`${menuItem} ${action === "erase" ? "!text-ui-red" : ""}`} disabled={!!hint} title={hint} onClick={() => act(action)}>
                      <ItemIcon size={14} /> {t(`action.${action}`)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/* Progress and speed in one block: the bars are recent down rates, coloured up to the progress edge. */}
      <div className="relative isolate flex min-h-[110px] items-end overflow-hidden px-[18px] py-[10px] -mx-[18px] -mb-[16px]">
        <div className="absolute inset-0 -z-10 flex items-end gap-[2px]" aria-label={t("detail.graph")} role="img">
          {/* With no traffic the bars are flat: a faint fill keeps the progress readable. */}
          <span className={`absolute inset-y-0 left-0 opacity-10 ${style.dot}`} style={{ width: `${d.progress * 100}%` }} />
          {bars.map((v, i) => (
            <span
              key={i}
              className={`flex-1 rounded-t-[2px] ${(i + 0.5) / BARS <= d.progress ? `${style.dot} opacity-85` : "bg-ui-border-strong"}`}
              style={{ height: `${Math.max((v / peak) * 76, v > 0 ? 6 : 2)}%` }}
            />
          ))}
          <span className={`absolute inset-y-0 w-[2px] ${style.dot}`} style={{ left: `min(${d.progress * 100}%, calc(100% - 2px))` }} />
        </div>
        <div className="flex flex-wrap items-end gap-[8px]">
          {stats.map(([value, label, tone], i) => (
            <div key={label} className="flex flex-col gap-[2px] rounded-[8px] bg-ui-bg/85 px-[10px] py-[6px]">
              <span className={`whitespace-nowrap font-code font-semibold tabular-nums ${i === 0 ? "text-[24px]" : "text-[14px]"} ${tone ?? "text-ui-text"}`}>{value}</span>
              <span className="text-[11px] text-ui-text-2">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
