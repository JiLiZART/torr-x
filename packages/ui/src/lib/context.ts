import { createContext, useContext } from "react";
import type { Capabilities, Preferences } from "@torrentx/api-client";
import { formatDate } from "./format";
import { makeT, type T } from "./i18n";

export interface Ui {
  t: T;
  prefs: Preferences;
  caps: Capabilities | null;
  date: (unixSecs: number | null) => string;
  /** Undefined when `feature` is usable, else the hint explaining why not. */
  gate: (feature: string) => string | undefined;
}

export const DEFAULT_PREFS: Preferences = {
  startWithSystem: false,
  startMinimized: false,
  confirmExitWhileDownloading: true,
  checkForUpdates: true,
  language: "en",
  theme: "hacker",
  useSystemTheme: false,
  showSpeedGraph: true,
  showPieceMap: true,
  dateFormat: "relative",
  notifications: { enabled: false, onComplete: true, onAdd: false, sound: false },
};

export function makeUi(prefs: Preferences, caps: Capabilities | null): Ui {
  const t = makeT(prefs.language);
  return {
    t,
    prefs,
    caps,
    date: (secs) => formatDate(secs, prefs.dateFormat, prefs.language),
    gate: (feature) => {
      // Unknown capabilities (not loaded yet) never block a control; the server still rejects.
      const f = caps?.features[feature];
      if (!caps || !f || f.supported) return undefined;
      return f.note ?? t("caps.notSupported", { engine: caps.engine });
    },
  };
}

export const UiContext = createContext<Ui>(makeUi(DEFAULT_PREFS, null));
export const useUi = () => useContext(UiContext);
