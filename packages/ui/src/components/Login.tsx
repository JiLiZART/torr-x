import { useState, type FormEvent } from "react";
import { Lock } from "lucide-react";
import { api } from "@torrentx/api-client";
import { useUi } from "../lib/context";
import { Modal, inputClass, primaryButtonClass } from "./Modal";

export function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const { t } = useUi();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.login(username, password);
      onLoggedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return (
    <div className="h-full bg-tx-base font-mono">
      <Modal
        title={
          <>
            <Lock size={16} className="mr-2" /> {t("login.title")}
          </>
        }
        width="max-w-sm"
      >
        <form onSubmit={submit} className="space-y-3">
          <input
            className={inputClass}
            placeholder={t("login.username")}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
          <input
            className={inputClass}
            type="password"
            placeholder={t("login.password")}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button type="submit" className={`${primaryButtonClass} w-full justify-center`} disabled={busy}>
            {busy ? t("login.busy") : t("login.submit")}
          </button>
        </form>
      </Modal>
    </div>
  );
}
