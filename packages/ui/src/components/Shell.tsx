import type { DragEvent, ReactNode } from "react";
import { WindowDots } from "./Sidebar";

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
    <div className="relative flex h-full w-full bg-ui-bg font-ui text-ui-text" onDragOver={onDragOver} onDrop={onDrop}>
      <WindowDots />
      {sidebar}
      <div className="flex min-w-0 flex-1 flex-col">
        {top}
        {children}
        {status}
      </div>
    </div>
  );
}
