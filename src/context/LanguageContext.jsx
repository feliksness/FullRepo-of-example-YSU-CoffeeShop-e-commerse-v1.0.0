// Coffee Lab — language context (HY default, persisted) · Built by FeliksKhangeldyan
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CONFIG } from "../config/config.js";
import { translate } from "../i18n/index.js";
import { KEYS, load, save } from "../utils/storage.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = load(KEYS.lang, null);
    return stored === "en" || stored === "hy" ? stored : CONFIG.DEFAULT_LANGUAGE;
  });
  const setLang = useCallback((l) => {
    setLangState(l);
    save(KEYS.lang, l);
  }, []);
  const t = useCallback((key, vars) => translate(lang, key, vars), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = translate(lang, "meta.title");
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useI18n = () => useContext(LanguageContext);
