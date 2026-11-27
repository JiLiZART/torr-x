import { useEffect, useState, type FormEvent } from "react";
import { Check, ChevronsDown, CircleAlert, Eye, EyeOff, Info, Lock, TriangleAlert } from "lucide-react";
import { api, ApiError } from "@torrentx/api-client";
import { useUi } from "../lib/context";

interface LoginProps {
  onLoggedIn: () => void;
  /** A signed-in session ended: say so. The address is kept, so signing in returns to the same view. */
  expired: boolean;
  version?: string;
}

const LOOPBACK = ["localhost", "127.0.0.1", "[::1]", "::1"];

/** The sign-in screen (screen 20): password only, remember-me, lockout countdown. Never shown with auth off. */
export function Login({ onLoggedIn, expired, version }: LoginProps) {
  const { t } = useUi();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seconds until the server accepts attempts again; counts down on its own.
  const [lockedFor, setLockedFor] = useState(0);
  const locked = lockedFor > 0;

  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => setLockedFor((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(timer);
  }, [locked]);
  useEffect(() => {
    if (!locked && error === "locked") setError(null);
  }, [locked, error]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (locked || busy) return;
    setBusy(true);
    try {
      await api.login(password, remember);
      onLoggedIn();
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.kind === "locked_out") {
        setLockedFor(err.extra.retryAfterSecs ?? 60);
        setError("locked");
      } else if (err instanceof ApiError && err.kind === "unauthorized" && err.extra.attemptsLeft !== undefined) {
        // The typed value stays so it can be corrected.
        setError(t("login.invalid", { n: err.extra.attemptsLeft }));
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const plainHttp = window.location.protocol === "http:" && !LOOPBACK.includes(window.location.hostname);
  const invalid = error !== null && error !== "locked";

  return (
    <div className="flex h-full flex-col bg-ui-bg font-sans">
      <div className="flex shrink-0 items-center gap-[8px] border-b border-ui-border bg-ui-chrome px-[16px] py-[9px] font-code text-[11px]">
        {plainHttp ? <TriangleAlert size={12} className="text-ui-amber" /> : <Lock size={12} className="text-ui-text-3" />}
        <span className="text-ui-text-2">{window.location.origin}/</span>
        {plainHttp && <span className="text-ui-amber">{t("login.notEncrypted")}</span>}
      </div>
      <div className="flex flex-1 flex-col items-center gap-[22px] overflow-y-auto px-[16px] pt-[12vh] pb-[24px]">
        <div className="flex items-center gap-[11px]">
          <span className="flex h-[36px] w-[36px] items-center justify-center rounded-[11px] border border-ui-accent-line bg-ui-accent-soft text-ui-accent">
            <ChevronsDown size={18} />
          </span>
          <span className="text-[23px] font-semibold text-ui-text">torrentx</span>
        </div>
        <form onSubmit={submit} className="w-full max-w-[420px] overflow-hidden rounded-[16px] border border-ui-border-strong bg-ui-surface shadow-xl">
          <div className="flex flex-col gap-[6px] px-[24px] pt-[22px] pb-[16px]">
            <h1 className="text-[19px] font-semibold text-ui-text">{t("login.title")}</h1>
            <p className={`text-[12px] leading-[18px] ${expired ? "text-ui-amber" : "text-ui-text-2"}`}>{t(expired ? "login.expired" : "login.sub")}</p>
          </div>
          <div className="flex flex-col gap-[12px] px-[24px] pb-[20px]">
            <label htmlFor="tx-password" className="text-[11.5px] font-medium text-ui-text-2">
              {t("login.password")}
            </label>
            <div className={`flex items-center gap-[9px] rounded-[9px] border bg-ui-surface-2 px-[12px] py-[11px] ${invalid ? "border-ui-red" : "border-ui-border focus-within:border-ui-accent-line"}`}>
              <Lock size={14} className="shrink-0 text-ui-text-3" />
              <input
                id="tx-password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={invalid}
                className="min-w-0 flex-1 bg-transparent font-code text-[13px] text-ui-text outline-none"
              />
              <button type="button" onClick={() => setShow(!show)} aria-label={t(show ? "login.hide" : "login.show")} className="text-ui-text-3 hover:text-ui-text-2">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {error && (
              <p role="alert" className="flex items-center gap-[7px] text-[11.5px] leading-[17px] text-ui-red">
                <CircleAlert size={13} className="shrink-0" /> {error === "locked" ? t("login.locked", { n: lockedFor }) : error}
              </p>
            )}
            <label className="flex cursor-pointer items-center gap-[9px] text-[12px] text-ui-text-2">
              <input type="checkbox" className="peer sr-only" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span className="flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border border-ui-border-strong text-ui-bg peer-checked:border-ui-accent peer-checked:bg-ui-accent peer-focus-visible:ring-1 peer-focus-visible:ring-ui-accent-line">
                {remember && <Check size={11} strokeWidth={3} />}
              </span>
              {t("login.remember")}
            </label>
            <button
              type="submit"
              disabled={busy || locked}
              className="flex items-center justify-center gap-[8px] rounded-[9px] bg-ui-accent px-[16px] py-[12px] text-[13px] font-semibold text-ui-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {locked ? t("login.retryIn", { n: lockedFor }) : busy ? t("login.busy") : t("login.submit")}
              {!locked && !busy && <span className="font-code text-[11px] font-normal">⏎</span>}
            </button>
          </div>
          <div className="flex items-center gap-[9px] border-t border-ui-border bg-ui-surface-2 px-[24px] py-[13px] font-code text-[10px] leading-[15px] text-ui-text-3">
            <Info size={12} className="shrink-0" /> {t("login.reset")}
          </div>
        </form>
        <p className="max-w-[560px] text-center font-code text-[10px] leading-[15px] text-ui-text-3">
          {version ? `torrentx v${version} · ` : ""}
          {t("login.desktop")}
        </p>
      </div>
    </div>
  );
}
