// Coffee Lab — shared admin UI pieces (range picker, KPI tiles, chart cards)
import { useState } from "react";
import { useI18n } from "../../context/LanguageContext.jsx";
import { toDateInput } from "../../utils/format.js";

export const SERIES = { s1: "#c8692a", s2: "#2a78d6", s3: "#1a9e6e" };

export function rangeFromPreset(preset) {
  if (preset === "all") return { from: "", to: "" };
  const days = { d7: 7, d30: 30, d90: 90 }[preset] || 30;
  const to = new Date();
  const from = new Date(Date.now() - (days - 1) * 86400000);
  return { from: toDateInput(from), to: toDateInput(to) };
}

export function RangePicker({ value, onChange }) {
  const { t } = useI18n();
  const [custom, setCustom] = useState({ from: value.from, to: value.to });
  return (
    <div className="range-picker">
      <div className="segmented" role="group">
        {["d7", "d30", "d90", "all", "custom"].map((p) => (
          <button key={p} type="button" className={value.preset === p ? "is-active" : ""}
            onClick={() => (p === "custom" ? onChange({ preset: "custom", ...custom }) : onChange({ preset: p, ...rangeFromPreset(p) }))}>
            {t(`admin.range.${p}`)}
          </button>
        ))}
      </div>
      {value.preset === "custom" && (
        <div className="range-picker__custom">
          <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} aria-label={t("common.from")} />
          <span>→</span>
          <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} aria-label={t("common.to")} />
          <button className="btn btn--sm" type="button" onClick={() => onChange({ preset: "custom", ...custom })}>{t("common.apply")}</button>
        </div>
      )}
    </div>
  );
}

export function Kpi({ label, value, sub, tone, big }) {
  return (
    <div className={`kpi ${big ? "kpi--big" : ""} ${tone ? `kpi--${tone}` : ""}`}>
      <span className="kpi__label">{label}</span>
      <strong className="kpi__value">{value}</strong>
      {sub && <span className="kpi__sub">{sub}</span>}
    </div>
  );
}

export function ChartCard({ title, children, table, wide }) {
  const { t } = useI18n();
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={`chart-card ${wide ? "chart-card--wide" : ""}`}>
      <header>
        <h3>{title}</h3>
        {table && <button type="button" className="link-btn" onClick={() => setShowTable((s) => !s)}>{showTable ? t("admin.charts.chart") : t("admin.charts.table")}</button>}
      </header>
      {showTable && table ? <div className="table-wrap table-wrap--chart">{table}</div> : children}
    </section>
  );
}

export function StatusPill({ status }) {
  const { t } = useI18n();
  return <span className={`status status--${status}`}>{t(`status.${status}`)}</span>;
}

export function AdminError({ error, onRetry }) {
  const { t } = useI18n();
  if (!error) return null;
  const msg = t(`errors.${error.code}`);
  return (
    <div className="notice notice--error">
      {msg.startsWith("errors.") ? t("errors.UNKNOWN") : msg}
      {onRetry && <button className="link-btn" onClick={onRetry}>{t("common.retry")}</button>}
    </div>
  );
}
