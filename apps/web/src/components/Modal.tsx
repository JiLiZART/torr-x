import type { ReactNode } from "react";
import { X } from "lucide-react";

interface ModalProps {
  title: ReactNode;
  onClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function Modal({ title, onClose, children, footer, width = "max-w-lg" }: ModalProps) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className={`bg-gray-950 border border-green-900/50 rounded-lg shadow-xl w-full ${width} max-h-[90vh] flex flex-col`}
      >
        <div className="flex justify-between items-center p-4 border-b border-green-900/30">
          <h2 className="text-green-400 font-semibold flex items-center">{title}</h2>
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-green-500 hover:text-green-400 p-1 rounded-md hover:bg-gray-900 transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <div className="flex-1 p-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-green-900/30 p-4 bg-black/30 flex items-center justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export const inputClass =
  "w-full bg-gray-900 border border-green-900/50 rounded px-3 py-1.5 text-sm text-green-400 placeholder-green-800 focus:outline-none focus:ring-1 focus:ring-green-700 disabled:opacity-50";
export const buttonClass =
  "text-xs bg-gray-800 hover:bg-gray-700 text-green-400 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";
export const primaryButtonClass =
  "flex items-center text-xs bg-green-800 hover:bg-green-700 text-green-100 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";
export const dangerButtonClass =
  "flex items-center text-xs bg-red-900/60 hover:bg-red-800 text-red-100 py-1.5 px-4 rounded-md transition-colors disabled:opacity-50";
