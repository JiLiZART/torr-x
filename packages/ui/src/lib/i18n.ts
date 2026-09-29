import type { Language } from "@torrentx/api-client";
import en from "../i18n/en.json";
import fr from "../i18n/fr.json";
import de from "../i18n/de.json";
import es from "../i18n/es.json";
import ru from "../i18n/ru.json";
import zh from "../i18n/zh.json";

export type T = (key: string, vars?: Record<string, string | number>) => string;

const DICTS: Record<Language, Record<string, string>> = { en, fr, de, es, ru, zh };

export const LANGUAGES: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "es", label: "Español" },
  { value: "ru", label: "Русский" },
  { value: "zh", label: "中文" },
];

/** Translator for `lang` with English fallback and `{var}` interpolation. */
export function makeT(lang: Language): T {
  const dict = DICTS[lang] ?? en;
  const fallback: Record<string, string> = en;
  return (key, vars) => {
    let s = dict[key] ?? fallback[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
  };
}
