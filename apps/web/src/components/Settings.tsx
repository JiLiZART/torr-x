import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, Save, Sliders } from "lucide-react";
import { api, type EngineKind, type Settings as SettingsData } from "@torrentx/api-client";
import { isLoopback } from "../lib/format";
import { Modal, buttonClass, inputClass, primaryButtonClass } from "./Modal";

interface SettingsProps {
  onClose: () => void;
  onSaved: () => void;
  onError: (e: unknown) => void;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block mb-3">
      <span className="block text-xs text-green-600 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-green-800 mt-1">{hint}</span>}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="text-xs font-semibold text-green-500 uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </section>
  );
}

export function Settings({ onClose, onSaved, onError }: SettingsProps) {
  const [s, setS] = useState<SettingsData | null>(null);
  // Write-only fields; only sent when the user typed something.
  const [authPassword, setAuthPassword] = useState("");
  const [trPassword, setTrPassword] = useState<string | undefined>(undefined);
  const [hosts, setHosts] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    api.getSettings().then((data) => {
      setS(data);
      setHosts(data.server.allowedHosts.join(", "));
    }, onError);
  }, [onError]);

  if (!s) return null;

  const update = (fn: (draft: SettingsData) => void) =>
    setS((prev) => {
      const next = structuredClone(prev!);
      fn(next);
      return next;
    });

  const exposedWithoutAuth = !isLoopback(s.server.bind) && !s.auth.enabled;

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(null);
    const body: SettingsData = structuredClone(s);
    body.server.allowedHosts = hosts.split(",").map((h) => h.trim()).filter(Boolean);
    if (authPassword) body.auth.password = authPassword;
    if (trPassword !== undefined) body.engine.transmission.password = trPassword;
    delete body.engine.transmission.hasPassword;
    try {
      const res = await api.saveSettings(body);
      setS(res.settings);
      setAuthPassword("");
      setTrPassword(undefined);
      setSaved(
        res.restartRequired
          ? "Saved. Restart TorrentX for the new address/port to take effect."
          : "Saved.",
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={
        <>
          <Sliders size={16} className="mr-2" /> Settings
        </>
      }
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <div className="flex-1 text-xs">
            {error && <span className="text-red-400">{error}</span>}
            {saved && <span className="text-green-500">{saved}</span>}
          </div>
          <button className={buttonClass} onClick={onClose}>
            Close
          </button>
          <button className={primaryButtonClass} onClick={save} disabled={busy}>
            <Save size={12} className="mr-1.5" /> Save
          </button>
        </>
      }
    >
      <Section title="Server">
        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field label="Bind address" hint="127.0.0.1 = this machine only, 0.0.0.0 = all interfaces">
            <input
              className={inputClass}
              value={s.server.bind}
              onChange={(e) => update((d) => void (d.server.bind = e.target.value))}
            />
          </Field>
          <Field label="Port">
            <input
              className={inputClass}
              type="number"
              min={1}
              max={65535}
              value={s.server.port}
              onChange={(e) => update((d) => void (d.server.port = Number(e.target.value)))}
            />
          </Field>
        </div>
        <Field label="Extra allowed host names" hint="Comma separated, e.g. nas.local. Needed only when bound to 127.0.0.1 behind a proxy.">
          <input className={inputClass} value={hosts} onChange={(e) => setHosts(e.target.value)} />
        </Field>
        {exposedWithoutAuth && (
          <p className="flex items-start gap-2 text-xs text-yellow-400 bg-yellow-950/40 border border-yellow-900/60 rounded p-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            The server will be reachable from other machines without a password. Anyone on the network could
            control your torrents. Enable authentication below.
          </p>
        )}
      </Section>

      <Section title="Authentication">
        <label className="flex items-center gap-2 text-sm text-green-400 mb-3 cursor-pointer">
          <input
            type="checkbox"
            checked={s.auth.enabled}
            onChange={(e) => update((d) => void (d.auth.enabled = e.target.checked))}
          />
          Require username and password
        </label>
        {s.auth.enabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Username">
              <input
                className={inputClass}
                autoComplete="username"
                value={s.auth.username}
                onChange={(e) => update((d) => void (d.auth.username = e.target.value))}
              />
            </Field>
            <Field label="Password" hint="Leave empty to keep the current password">
              <input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
              />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Engine">
        <div className="flex gap-4 mb-3">
          {(["rqbit", "transmission"] as EngineKind[]).map((k) => (
            <label key={k} className="flex items-center gap-2 text-sm text-green-400 cursor-pointer">
              <input
                type="radio"
                name="engine"
                checked={s.engine.kind === k}
                onChange={() => update((d) => void (d.engine.kind = k))}
              />
              {k === "rqbit" ? "Built-in (rqbit)" : "Transmission daemon"}
            </label>
          ))}
        </div>
        {s.engine.kind === "rqbit" ? (
          <Field label="Download directory" hint="Absolute path on the machine running the server">
            <input
              className={inputClass}
              value={s.engine.rqbit.downloadDir}
              onChange={(e) => update((d) => void (d.engine.rqbit.downloadDir = e.target.value))}
            />
          </Field>
        ) : (
          <>
            <Field label="RPC URL">
              <input
                className={inputClass}
                value={s.engine.transmission.url}
                onChange={(e) => update((d) => void (d.engine.transmission.url = e.target.value))}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="RPC username">
                <input
                  className={inputClass}
                  value={s.engine.transmission.username}
                  onChange={(e) => update((d) => void (d.engine.transmission.username = e.target.value))}
                />
              </Field>
              <Field label="RPC password">
                <input
                  className={inputClass}
                  type="password"
                  placeholder={s.engine.transmission.hasPassword ? "(unchanged)" : ""}
                  value={trPassword ?? ""}
                  onChange={(e) => setTrPassword(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}
      </Section>
    </Modal>
  );
}
