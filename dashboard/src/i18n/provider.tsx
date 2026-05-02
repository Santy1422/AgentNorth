"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { en, type TranslationKey } from "./en";
import { es } from "./es";

export type Locale = "en" | "es";

const messages: Record<Locale, Record<string, string>> = { en, es };

// Allow any string but suggest known keys for autocomplete
type TKey = TranslationKey | (string & {});

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => key,
});

function getInitialLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("an-locale");
  if (saved === "en" || saved === "es") return saved;
  // Auto-detect from browser
  const nav = navigator.language?.toLowerCase() || "";
  return nav.startsWith("es") ? "es" : "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("an-locale", l);
  }, []);

  const t = useCallback(
    (key: TKey, vars?: Record<string, string | number>): string => {
      let str = messages[locale][key] || messages.en[key] || key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }
      return str;
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useT() {
  return useContext(I18nContext);
}
