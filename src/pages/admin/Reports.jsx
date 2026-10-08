// Coffee Lab — financial reports: daily / monthly / custom range + PDF export to Google Drive.
import { useState } from "react";
import { useI18n } from "../../context/LanguageContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { generateReportPdf, getFinancialReport, rebuildReports } from "../../api/endpoints.js";
import useAdminQuery, { useAdminAction } from "../../hooks/useAdminQuery.js";
import { formatMoney, formatPercent, productName } from "../../utils/format.js";
import { errorMessage } from "../../utils/errors.js";
import { Spinner } from "../../components/States.jsx";
import { AdminError, Kpi, RangePicker, rangeFromPreset } from "./ui.jsx";

function PeriodTable({ rows, keyName, t }) {
  const nonEmpty = rows.filter((r) => r.orders || r.operating_expenses);
  return (
    <div className="table-wrap table-wrap--tall">
      <table className="table table--compact">
        <thead><tr>
          <th>{keyName === "date" ? t("admin.reports.date") : t("admin.reports.month")}</th>
          <th className="r">{t("admin.kpi.orders")}</th><th className="r">{t("admin.kpi.units")}</th><th className="r">{t("admin.kpi.revenue")}</th>
          <th className="r">{t("admin.kpi.cogs")}</th><th className="r">{t("admin.kpi.grossProfit")}</th><th className="r">%</th>
          <th className="r">{t("admin.kpi.delivery")}</th><th className="r">{t("admin.kpi.opex")}</th><th className="r">{t("admin.kpi.netProfit")}</th><th className="r">{t("admin.kpi.aov")}</th>
        </tr></thead>
        <tbody>
          {nonEmpty.map((r) => (
            <tr key={r[keyName]}>
              <td className="mono small">{r[keyName]}</td><td className="r">{r.orders}</td><td className="r">{r.units_sold}</td>
              <td className="r">{formatMoney(r.revenue)}</td><td className="r">{formatMoney(r.cogs)}</td><td className="r">{formatMoney(r.gross_profit)}</td>
              <td className="r">{formatPercent(r.gross_margin)}</td><td className="r">{formatMoney(r.delivery_income)}</td>
              <td className="r">{formatMoney(r.operating_expenses)}</td><td className={`r ${r.net_profit < 0 ? "neg" : ""}`}>{formatMoney(r.net_profit)}</td>
              <td className="r">{formatMoney(r.average_order_value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Reports() {
  const { t, lang } = useI18n();
  const { notify } = useToast();
  const [run, busy] = useAdminAction();
  const [range, setRange] = useState({ preset: "d30", ...rangeFromPreset("d30") });
  const [view, setView] = useState("monthly");
  const [pdfLang, setPdfLang] = useState(lang);
  const [pdf, setPdf] = useState(null);
  const [pdfErr, setPdfErr] = useState(null);
  const { data, error, loading, reload } = useAdminQuery((pin) => getFinancialReport(pin, { from: range.from, to: range.to }), [range.from, range.to]);

  const makePdf = async () => {
    setPdf(null);
    setPdfErr(null);
    try {
      const r = await run((pin) => generateReportPdf(pin, { from: range.from, to: range.to }, pdfLang));
      setPdf(r);
      notify(t("admin.reports.ready"), "success");
    } catch (err) { setPdfErr(err); }
  };
  const rebuild = async () => {
    try { await run((pin) => rebuildReports(pin)); notify(t("admin.reports.rebuilt"), "success"); reload(); }
    catch (err) { notify(errorMessage(err, t), "error"); }
  };

  const s = data?.summary;
  return (
    <div>
      <div className="admin-toolbar">
        <RangePicker value={range} onChange={setRange} />
        {loading && <span className="spinner spinner--sm" />}
        {data && <span className="muted small">{data.range.from} → {data.range.to}</span>}
      </div>
      <AdminError error={error} onRetry={reload} />
      {!data && loading && <Spinner />}
      {data && (
        <>
          <section className="panel report-actions">
            <div>
              <h3>{t("admin.reports.title")}</h3>
              <p className="muted small">{t("admin.reports.summary")}</p>
            </div>
            <label className="select-field">
              <span>{t("admin.reports.lang")}</span>
              <select value={pdfLang} onChange={(e) => setPdfLang(e.target.value)}><option value="en">English</option><option value="hy">Հայերեն</option></select>
            </label>
            <button className="btn" onClick={makePdf} disabled={busy}>{busy ? t("admin.reports.generating") : `⬇ ${t("admin.reports.generate")}`}</button>
            <button className="btn btn--ghost btn--sm" onClick={rebuild} disabled={busy}>{t("admin.reports.rebuild")}</button>
            {pdf && (
              <div className="notice notice--success report-actions__result">
                {t("admin.reports.ready")}: <strong>{pdf.name}</strong>
                <a className="btn btn--sm" href={pdf.url} target="_blank" rel="noreferrer">{t("admin.reports.open")} ↗</a>
                <a className="btn btn--ghost btn--sm" href={pdf.download_url} target="_blank" rel="noreferrer">{t("admin.reports.download")}</a>
              </div>
            )}
            {pdfErr && <div className="notice notice--error report-actions__result">{errorMessage(pdfErr, t)}</div>}
          </section>

          <div className="kpi-grid">
            <Kpi label={t("admin.kpi.revenue")} value={formatMoney(s.revenue)} sub={`${t("admin.kpi.grossSales")} ${formatMoney(s.gross_sales)}`} />
            <Kpi label={t("admin.kpi.cogs")} value={formatMoney(s.cogs)} />
            <Kpi label={t("admin.kpi.grossProfit")} value={formatMoney(s.gross_profit)} sub={formatPercent(s.gross_margin)} />
            <Kpi label={t("admin.kpi.opex")} value={formatMoney(s.operating_expenses)} />
            <Kpi label={t("admin.kpi.netProfit")} value={formatMoney(s.net_profit)} tone={s.net_profit < 0 ? "neg" : "pos"} sub={formatPercent(s.net_margin)} />
            <Kpi label={t("admin.kpi.orders")} value={s.orders} sub={`${t("admin.kpi.aov")} ${formatMoney(s.average_order_value)}`} />
            <Kpi label={t("admin.kpi.inventoryValue")} value={formatMoney(s.inventory_value)} sub={`${t("admin.kpi.purchases")} ${formatMoney(s.total_purchases)}`} />
          </div>

          <section className="panel panel--flush">
            <div className="admin-toolbar admin-toolbar--in">
              <div className="segmented">
                {["daily", "monthly"].map((v) => <button key={v} className={view === v ? "is-active" : ""} onClick={() => setView(v)}>{t(`admin.reports.${v}`)}</button>)}
              </div>
            </div>
            {view === "daily" ? <PeriodTable rows={data.daily} keyName="date" t={t} /> : <PeriodTable rows={data.monthly} keyName="month" t={t} />}
          </section>

          <section className="panel panel--flush">
            <div className="admin-toolbar admin-toolbar--in"><h3>{t("admin.reports.sales")}</h3></div>
            <div className="table-wrap table-wrap--tall">
              <table className="table table--compact">
                <thead><tr><th>{t("admin.reports.product")}</th><th className="r">{t("common.qty")}</th><th className="r">{t("admin.kpi.revenue")}</th><th className="r">COGS</th><th className="r">{t("admin.orders.profit")}</th><th className="r">{t("admin.orders.margin")}</th></tr></thead>
                <tbody>
                  {data.product_sales.map((p) => (
                    <tr key={p.product_id}><td>{productName(p, lang)} <span className="mono muted small">{p.sku}</span></td><td className="r">{p.quantity}</td>
                      <td className="r">{formatMoney(p.revenue)}</td><td className="r">{formatMoney(p.cogs)}</td><td className="r">{formatMoney(p.profit)}</td><td className="r">{formatPercent(p.margin)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
