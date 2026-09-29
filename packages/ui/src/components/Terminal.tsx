import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { api } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { run, type TerminalDeps } from "../lib/terminal";

const deps: TerminalDeps = {
  list: api.list,
  stats: api.stats,
  addUri: (uri) => api.addUri(uri),
  pause: api.pause,
  resume: api.resume,
  remove: (id) => api.remove(id, false),
};

export function Terminal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const { t } = useUi();
  const welcome = [`> ${t("terminal.welcome")}`, `> ${t("terminal.hint")}`, ">"];
  const [command, setCommand] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>(welcome);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history]);

  const handleCommand = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !command.trim() || busy) return;
    const line = command;
    setCommand("");
    setBusy(true);
    const res = await run(line, deps);
    setBusy(false);
    if (res.action === "clear") return setHistory(welcome);
    setHistory((h) => [...h, `> ${line}`, ...res.lines.map((l) => `  ${l}`), ">"]);
    if (res.action === "exit") onClose();
    else onChanged();
  };

  return (
    <div className="border-t border-tx-accent-900/30 bg-tx-base h-64 overflow-y-auto p-4 text-sm font-mono">
      <div className="flex justify-between items-center mb-2">
        <span className="text-tx-accent-500 font-semibold">{t("terminal.title")}</span>
        <button className="text-tx-accent-500 hover:text-tx-accent-400" onClick={onClose} aria-label={t("common.close")}>
          <X size={16} />
        </button>
      </div>
      <div className="text-tx-accent-500 space-y-1">
        {history.map((line, index) => (
          <div
            key={index}
            className={`whitespace-pre-wrap ${line.startsWith(">") ? "text-tx-accent-400" : "text-tx-accent-600"}`}
          >
            {line}
          </div>
        ))}
        <div className="flex items-center">
          <span className="text-tx-accent-400 mr-1">&gt;</span>
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleCommand}
            className="flex-1 bg-transparent border-none outline-none text-tx-accent-400 focus:ring-0"
            autoFocus
          />
          <span className="animate-caret-blink text-tx-accent-400">▋</span>
        </div>
      </div>
      <div ref={terminalEndRef} />
    </div>
  );
}
