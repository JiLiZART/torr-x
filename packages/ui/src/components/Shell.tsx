import type { DragEvent, ReactNode } from "react";

interface ShellProps {
  /** Null while collapsed. */
  sidebar: ReactNode;
  top: ReactNode;
  status: ReactNode;
  children: ReactNode;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
}

/** Browser-style frame: sidebar on the left; top bar, content and status bar stacked beside it. */
export function Shell({ sidebar, top, status, children, onDragOver, onDrop }: ShellProps) {
  return (
    <div className="flex h-full w-full bg-tx-base font-mono text-tx-accent-500" onDragOver={onDragOver} onDrop={onDrop}>
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {top}
        {children}
        {status}
      </div>
    </div>
  );
}
