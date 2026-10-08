// Coffee Lab — friendly error messages (never shows raw Apps Script errors).
export function errorMessage(err, t) {
  const code = err && err.code;
  const key = `errors.${code}`;
  const msg = code ? t(key) : null;
  return msg && msg !== key ? msg : t("errors.UNKNOWN");
}
