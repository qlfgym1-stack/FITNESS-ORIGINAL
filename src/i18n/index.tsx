import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import fr from "./fr";
import ar from "./ar";

type TranslationValue = string | Record<string, unknown>;

interface I18nContextValue {
  locale: string;
  t: (key: string) => string;
  setLocale: (locale: string) => void;
}

const translations: Record<string, Record<string, TranslationValue>> = {
  fr,
  ar,
};

function getInitialLocale(): string {
  if (typeof window === "undefined") return "fr";
  const stored = localStorage.getItem("locale");
  if (stored && translations[stored]) return stored;
  const navLang = navigator.language?.slice(0, 2);
  if (navLang && translations[navLang]) return navLang;
  return "fr";
}

function resolveKey(obj: Record<string, TranslationValue>, key: string): string {
  const parts = key.split(".");
  let current: TranslationValue = obj;
  for (const part of parts) {
    if (typeof current !== "object" || current === null) return key;
    current = (current as Record<string, TranslationValue>)[part];
  }
  return typeof current === "string" ? current : key;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(getInitialLocale);

  const setLocale = useCallback((newLocale: string) => {
    if (translations[newLocale]) {
      setLocaleState(newLocale);
      localStorage.setItem("locale", newLocale);
    }
  }, []);

  const t = useCallback(
    (key: string): string => {
      const dict = translations[locale] as Record<string, TranslationValue> | undefined;
      if (!dict) return key;
      return resolveKey(dict, key);
    },
    [locale],
  );

  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, t, setLocale }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useLocale(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useLocale must be used within an I18nProvider");
  return ctx;
}

export function useT(): I18nContextValue["t"] {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useT must be used within an I18nProvider");
  return ctx.t;
}
