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
    <div className="fixed inset-0 bg-ui-bg/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`bg-ui-surface border border-ui-border rounded-lg shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}
      >
        <div className="flex justify-between items-center p-4 border-b border-ui-border">
          <h2 className="text-ui-text font-semibold flex items-center">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              aria-label={t("common.close")}
              className="text-ui-accent hover:text-ui-text p-1 rounded-md hover:bg-ui-surface-2 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 p-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-ui-border p-4 bg-ui-bg/30 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full bg-ui-surface-2 border border-ui-border rounded px-3 py-1.5 text-sm text-ui-text placeholder-ui-text-3 focus:outline-none focus:ring-1 focus:ring-ui-accent-line disabled:opacity-50";
export const buttonClass =
  "text-xs bg-ui-surface-3 hover:bg-ui-border-strong text-ui-text py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";
export const primaryButtonClass =
  "flex items-center text-xs bg-ui-accent hover:opacity-90 text-ui-bg py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";
export const softButtonClass =
  "flex items-center text-xs bg-ui-accent-soft hover:bg-ui-accent-line/50 text-ui-text py-1 px-3 rounded-md transition-colors disabled:opacity-50";
export const dangerButtonClass =
  "flex items-center text-xs bg-ui-red-soft hover:bg-ui-red/30 text-ui-red py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";

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
        <label className="block text-sm text-ui-text">{label}</label>
        <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        {error && <p className="text-xs text-ui-red">{error}</p>}
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
