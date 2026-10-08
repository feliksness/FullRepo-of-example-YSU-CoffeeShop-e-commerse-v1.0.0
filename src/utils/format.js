// Coffee Lab — formatting helpers · Built by FeliksKhangeldyan
export function formatMoney(n, { sign = false } = {}) {
  const v = Math.round(Number(n) || 0);
  const s = Math.abs(v).toLocaleString("en-US");
  const prefix = v < 0 ? "−" : sign && v > 0 ? "+" : "";
  return `${prefix}${s} ֏`;
}

export function formatCompact(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(a >= 1e7 ? 0 : 1) + "M";
  if (a >= 1e3) return Math.round(v / 1e3) + "k";
  return String(Math.round(v));
}

export function formatPercent(n, digits = 1) {
  return `${(Number(n) || 0).toFixed(digits)}%`;
}

export function formatDate(iso, lang, withTime = false) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T12:00:00" : iso);
  if (isNaN(d)) return String(iso);
  const opts = { year: "numeric", month: "short", day: "numeric" };
  if (withTime) Object.assign(opts, { hour: "2-digit", minute: "2-digit" });
  try {
    return d.toLocaleString(lang === "hy" ? "hy-AM" : "en-GB", opts);
  } catch {
    return d.toLocaleString("en-GB", opts);
  }
}

export function toDateInput(d) {
  const x = d instanceof Date ? d : new Date(d);
  const p = (n) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

export function productName(p, lang) {
  if (!p) return "";
  return (lang === "hy" ? p.name_hy || p.name_en : p.name_en || p.name_hy) || p.product_name || p.sku;
}

export function productDescription(p, lang) {
  return lang === "hy" ? p.description_hy || p.description_en : p.description_en || p.description_hy;
}

export function weightLabel(p, t) {
  if (!p.weight_g) return null;
  const unit = p.unit === "bottle" ? t("product.ml") : t("product.g");
  return p.weight_g >= 1000 && unit === t("product.g") ? `${p.weight_g / 1000} kg` : `${p.weight_g} ${unit}`;
}
