import { useState, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import { useUi } from "../lib/context";

interface ModalProps {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function Modal({ title, onClose, children, footer, width = "max-w-lg" }: ModalProps) {
  const { t } = useUi();
  return (
    <div className="fixed inset-0 bg-tx-base/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`bg-tx-surface-950 border border-tx-accent-900/50 rounded-lg shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}
      >
        <div className="flex justify-between items-center p-4 border-b border-tx-accent-900/30">
          <h2 className="text-tx-accent-400 font-semibold flex items-center">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              className="text-tx-accent-500 hover:text-tx-accent-400 p-1 rounded-md hover:bg-tx-surface-900 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 p-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-tx-accent-900/30 p-4 bg-tx-base/30 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full bg-tx-surface-900 border border-tx-accent-900/50 rounded px-3 py-1.5 text-sm text-tx-accent-400 placeholder-tx-accent-700 focus:outline-none focus:ring-1 focus:ring-tx-accent-700 disabled:opacity-50";
export const buttonClass =
  "text-xs bg-tx-surface-800 hover:bg-tx-surface-700 text-tx-accent-400 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";
export const primaryButtonClass =
  "flex items-center text-xs bg-tx-accent-800 hover:bg-tx-accent-700 text-tx-accent-100 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";
export const softButtonClass =
  "flex items-center text-xs bg-tx-accent-900/30 hover:bg-tx-accent-900/50 text-tx-accent-400 py-1 px-3 rounded-md transition-colors disabled:opacity-50";
export const dangerButtonClass =
  "flex items-center text-xs bg-red-900/60 hover:bg-red-800 text-red-100 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";

interface PromptProps {
  title: ReactNode;
  label: string;
  initial: string;
  onClose: () => void;
  /** Throws to keep the dialog open and show the error. */
  onSubmit: (value: string) => Promise<void>;
}

export function PromptDialog({ title, label, initial, onClose, onSubmit }: PromptProps) {
  const { t } = useUi();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return setError(t("common.required"));
    setBusy(true);
    try {
      await onSubmit(value.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-sm text-tx-accent-400">{label}</label>
        <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end gap-3">
          <button type="button" className={buttonClass} onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button type="submit" className={primaryButtonClass} disabled={busy}>
            {t("common.ok")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
