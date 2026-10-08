// Coffee Lab — i18n helpers · Built by FeliksKhangeldyan
import hy from "./hy.js";
import en from "./en.js";

export const DICTIONARIES = { hy, en };
export const LANGUAGES = [
  { code: "hy", label: "HY", name: "Հայերեն" },
  { code: "en", label: "EN", name: "English" }
];

function lookup(dict, key) {
  return key.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);
}

/** Translate a dotted key with {placeholders}; falls back to English, then the key itself. */
export function translate(lang, key, vars) {
  let s = lookup(DICTIONARIES[lang] || en, key);
  if (s === undefined) s = lookup(en, key);
  if (s === undefined) return key;
  if (typeof s !== "string") return s;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  return s;
}
