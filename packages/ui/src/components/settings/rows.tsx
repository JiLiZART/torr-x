// The settings page's building blocks: a group card, a row, and the controls rows hold.
import { useState, type ReactNode } from "react";
import { Ban, Check } from "lucide-react";
import { useUi } from "../../lib/context";
import type { RowStatus } from "./useSettingsStore";

export function Group({ title, caption, children }: { title: string; caption?: string; children: ReactNode }) {
  return (
    <section className="w-full shrink-0 overflow-hidden rounded-[12px] border border-ui-border bg-ui-surface">
      <header className="flex items-center gap-[10px] border-b border-ui-border bg-ui-chrome-2 px-[16px] py-[12px]">
        <h3 className="whitespace-nowrap text-[13px] font-semibold text-ui-text">{title}</h3>
        {caption && <span className="min-w-0 flex-1 truncate font-code text-[10px] text-ui-text-3">{caption}</span>}
      </header>
      {children}
    </section>
  );
}

interface RowProps {
  /** Registry id: title `set.<id>`, description `set.<id>.desc`. */
  id: string;
  /** Replaces the registry title (rows whose title has parameters). */
  title?: string;
  /** Replaces the registry description (e.g. a live "checked 2 minutes ago"). */
  desc?: string;
  /** "not supported by <engine>": the row stays, its control is disabled and a badge says why. */
  unsupported?: string;
  status?: RowStatus;
  /** Briefly highlighted after a search jump. */
  focused?: boolean;
  /** Dims the row without a badge (e.g. proxy fields while no proxy is chosen). */
  muted?: boolean;
  children?: ReactNode;
}

export function Row({ id, title, desc, unsupported, status, focused, muted, children }: RowProps) {
  const { t } = useUi();
  const dim = !!unsupported || muted;
  return (
    <div
      data-row={id}
      className={`flex w-full items-center gap-[16px] border-b border-ui-border px-[16px] py-[9px] last:border-b-0 ${focused ? "bg-ui-accent-soft" : ""} transition-colors`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
        <span className={`text-[12.5px] font-medium ${dim ? "text-ui-text-3" : "text-ui-text"}`}>{title ?? t(`set.${id}`)}</span>
        <span className="text-[11px] leading-[17px] text-ui-text-3">{desc ?? t(`set.${id}.desc`)}</span>
        {status?.state === "error" && (
          <span role="alert" className="break-all text-[11px] text-ui-red">
            {status.message}
          </span>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-[8px]">
        {status?.state === "saving" && <span className="font-code text-[10px] text-ui-text-3">{t("set.saving")}</span>}
        {status?.state === "saved" && (
          <span role="status" className="flex items-center gap-[4px] font-code text-[10px] text-ui-accent">
            <Check size={11} /> {t("set.saved")}
          </span>
        )}
        {unsupported ? <Unsupported text={unsupported} /> : children}
      </div>
    </div>
  );
}

export function Unsupported({ text }: { text: string }) {
  return (
    <span className="flex items-center gap-[6px] whitespace-nowrap rounded-[6px] border border-dashed border-ui-border bg-ui-surface-2 px-[9px] py-[5px] font-code text-[10px] text-ui-text-3">
      <Ban size={11} /> {text}
    </span>
  );
}

/** A small status pill: green for good news, amber for a problem, grey for neutral. */
export function Chip({ tone, children }: { tone: "good" | "bad" | "neutral"; children: ReactNode }) {
  const look = tone === "good" ? "bg-ui-accent-soft text-ui-accent" : tone === "bad" ? "bg-ui-amber-soft text-ui-amber" : "bg-ui-surface-2 text-ui-text-2";
  const dot = tone === "good" ? "bg-ui-accent" : tone === "bad" ? "bg-ui-amber" : "bg-ui-text-3";
  return (
    <span className={`flex items-center gap-[6px] whitespace-nowrap rounded-[6px] px-[9px] py-[5px] font-code text-[10px] ${look}`}>
      <span className={`h-[6px] w-[6px] rounded-full ${dot}`} />
      {children}
    </span>
  );
}

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  const { t } = useUi();
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`flex items-center gap-[8px] rounded-[8px] border px-[10px] py-[7px] disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-ui-accent-line bg-ui-accent-soft" : "border-ui-border bg-ui-surface-2"}`}
    >
      <span className={`flex h-[14px] w-[24px] items-center rounded-full px-[2px] ${on ? "justify-end bg-ui-accent" : "justify-start bg-ui-surface-3"}`}>
        <span className={`h-[10px] w-[10px] rounded-full ${on ? "bg-ui-bg" : "bg-ui-text-3"}`} />
      </span>
      <span className={`text-[11.5px] font-medium ${on ? "text-ui-accent" : "text-ui-text-3"}`}>{on ? t("set.on") : t("set.off")}</span>
    </button>
  );
}

const input =
  "rounded-[8px] border border-ui-border bg-ui-surface-2 px-[10px] py-[8px] font-code text-[11.5px] text-ui-text focus:border-ui-accent focus:outline-none disabled:cursor-not-allowed disabled:opacity-50";

interface TextInputProps {
  value: string;
  /** Called on blur or Enter when the text changed; never per keystroke. */
  onCommit: (value: string) => void;
  label: string;
  width?: string;
  type?: "text" | "password";
  placeholder?: string;
  disabled?: boolean;
}

/** Commits on blur or Enter, so a half-typed path or port is never saved. Escape restores the value. */
export function TextInput({ value, onCommit, label, width = "w-[220px]", type = "text", placeholder, disabled }: TextInputProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    if (draft !== null && draft !== value) onCommit(draft);
    setDraft(null);
  };
  return (
    <input
      type={type}
      aria-label={label}
      className={`${input} ${width}`}
      value={draft ?? value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(null);
          e.currentTarget.blur();
        }
      }}
    />
  );
}

interface NumberInputProps {
  value: number;
  onCommit: (value: number) => void;
  label: string;
  min: number;
  max: number;
  /** Decimal values allowed (ratio). */
  decimal?: boolean;
  unit?: string;
  width?: string;
  disabled?: boolean;
}

/** A number field; text that is not a number in range is dropped and the value restored. */
export function NumberInput({ value, onCommit, label, min, max, decimal, unit, width = "w-[96px]", disabled }: NumberInputProps) {
  return (
    <span className="flex items-center gap-[6px]">
      <TextInput
        value={String(value)}
        label={label}
        width={width}
        disabled={disabled}
        onCommit={(text) => {
          const n = decimal ? Number(text) : Number.parseInt(text, 10);
          if (text.trim() !== "" && Number.isFinite(n) && n >= min && n <= max) onCommit(n);
        }}
      />
      {unit && <span className="font-code text-[10px] text-ui-text-3">{unit}</span>}
    </span>
  );
}

export function Select<V extends string>({
  value,
  onChange,
  options,
  label,
  width = "w-[180px]",
  disabled,
}: {
  value: V;
  onChange: (v: V) => void;
  options: { value: V; label: string; disabled?: string }[];
  label: string;
  width?: string;
  disabled?: boolean;
}) {
  return (
    <select aria-label={label} className={`${input} ${width}`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as V)}>
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={!!o.disabled} title={o.disabled}>
          {o.disabled ? `${o.label} (${o.disabled})` : o.label}
        </option>
      ))}
    </select>
  );
}

export function Button({ onClick, children, disabled, tone = "plain", title }: { onClick: () => void; children: ReactNode; disabled?: boolean; tone?: "plain" | "primary"; title?: string }) {
  const look = tone === "primary" ? "border-ui-accent bg-ui-accent text-ui-bg font-semibold" : "border-ui-border-strong bg-ui-surface-2 text-ui-text-2 hover:text-ui-text font-medium";
  return (
    <button onClick={onClick} disabled={disabled} title={title} className={`whitespace-nowrap rounded-[8px] border px-[11px] py-[8px] text-[11.5px] disabled:cursor-not-allowed disabled:opacity-50 ${look}`}>
      {children}
    </button>
  );
}
