// Coffee Lab — management dashboard: KPIs + charts computed by Apps Script (getDashboard).
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine
} from "recharts";
import { useI18n } from "../../context/LanguageContext.jsx";
import { getDashboard } from "../../api/endpoints.js";
import useAdminQuery from "../../hooks/useAdminQuery.js";
import { formatCompact, formatMoney, formatPercent, productName } from "../../utils/format.js";
import { Spinner } from "../../components/States.jsx";
import { AdminError, ChartCard, Kpi, RangePicker, SERIES, rangeFromPreset } from "./ui.jsx";

const AXIS = { fontSize: 11, fill: "#6b5546", fontFamily: "Inter, Noto Sans Armenian, sans-serif" };
const GRID = "#e8dccb";

/** Groups daily rows into weekly buckets when the range is long, so lines stay readable. */
function bucket(daily) {
  if (daily.length <= 45) return daily.map((d) => ({ ...d, label: d.date.slice(5) }));
  const out = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    const sum = (k) => chunk.reduce((s, d) => s + d[k], 0);
    out.push({ label: chunk[0].date.slice(5), revenue: sum("revenue"), gross_profit: sum("gross_profit"), net_profit: sum("net_profit"), orders: sum("orders") });
  }
  return out;
}

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <strong>{label}</strong>
      {payload.map((p) => (
        <div key={p.dataKey}><span className="chart-tip__swatch" style={{ background: p.color }} />{p.name}: <b>{p.dataKey === "orders" || p.dataKey === "quantity" ? p.value : formatMoney(p.value)}</b></div>
      ))}
    </div>
  );
}

function HBar({ data, dataKey, nameKey = "name", color = SERIES.s1, money = true, height, label }) {
  const { t } = useI18n();
  if (!data.length) return <p className="muted chart-empty">{t("admin.charts.noData")}</p>;
  return (
    <ResponsiveContainer width="100%" height={height || Math.max(180, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} tickFormatter={money ? formatCompact : undefined} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={nameKey} tick={AXIS} width={150} axisLine={false} tickLine={false} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(200,105,42,.08)" }} />
        <Bar dataKey={dataKey} name={label || t("admin.charts.revenue")} fill={color} radius={[0, 4, 4, 0]} maxBarSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function Overview() {
  const { t, lang } = useI18n();
  const [range, setRange] = useState({ preset: "d90", ...rangeFromPreset("d90") });
  const { data, error, loading, reload } = useAdminQuery((pin) => getDashboard(pin, { from: range.from, to: range.to }), [range.from, range.to]);

  const series = useMemo(() => (data ? bucket(data.daily) : []), [data]);
  if (!data && loading) return <Spinner />;
  if (!data) return <AdminError error={error} onRetry={reload} />;
  const s = data.summary;
  const name = (x) => productName(x, lang);
  const catData = data.by_category.filter((c) => c.revenue > 0).map((c) => ({ ...c, name: t(`categories.${c.category}`) })).sort((a, b) => b.revenue - a.revenue);
  const top = data.top_products.slice(0, 8).map((p) => ({ ...p, name: name(p) }));
  const profitable = data.most_profitable.slice(0, 8).map((p) => ({ ...p, name: name(p) }));
  const expenses = data.expenses_by_category.map((e) => ({ ...e, name: t(`admin.expenses.cat.${e.category}`) }));

  return (
    <div className="overview">
      <div className="admin-toolbar">
        <RangePicker value={range} onChange={setRange} />
        {loading && <span className="spinner spinner--sm" aria-label={t("common.loading")} />}
        <span className="muted small">{data.range.from} → {data.range.to}</span>
      </div>
      <AdminError error={error} onRetry={reload} />

      <div className="kpi-grid">
        <Kpi big label={t("admin.kpi.revenue")} value={formatMoney(s.revenue)} sub={`${t("admin.kpi.grossSales")} ${formatMoney(s.gross_sales)} · ${t("admin.kpi.discounts")} ${formatMoney(-s.discounts)}`} />
        <Kpi big label={t("admin.kpi.grossProfit")} value={formatMoney(s.gross_profit)} sub={`${t("admin.kpi.grossMargin")} ${formatPercent(s.gross_margin)} · ${t("admin.kpi.cogs")} ${formatMoney(s.cogs)}`} />
        <Kpi big label={t("admin.kpi.netProfit")} value={formatMoney(s.net_profit)} tone={s.net_profit < 0 ? "neg" : "pos"} sub={`${t("admin.kpi.netMargin")} ${formatPercent(s.net_margin)} · ${t("admin.kpi.opex")} ${formatMoney(s.operating_expenses)}`} />
        <Kpi label={t("admin.kpi.orders")} value={s.orders} sub={`${t("admin.kpi.units")}: ${s.units_sold}`} />
        <Kpi label={t("admin.kpi.aov")} value={formatMoney(s.average_order_value)} sub={`${t("admin.kpi.delivery")}: ${formatMoney(s.delivery_income)}`} />
        <Kpi label={t("admin.kpi.inventoryValue")} value={formatMoney(s.inventory_value)} sub={`${t("admin.kpi.purchases")}: ${formatMoney(s.total_purchases)}`} />
        <Kpi label={t("admin.kpi.lowStock")} value={s.low_stock_count} tone={s.low_stock_count ? "warn" : ""} sub={`${t("admin.kpi.outOfStock")}: ${s.out_of_stock_count}`} />
      </div>

      <div className="chart-grid">
        <ChartCard wide title={`${t("admin.charts.revenueProfit")}${data.daily.length > 45 ? " · " + t("admin.charts.weekly") : ""}`}
          table={<table className="table"><thead><tr><th>{t("admin.reports.date")}</th><th className="r">{t("admin.charts.revenue")}</th><th className="r">{t("admin.charts.grossProfit")}</th><th className="r">{t("admin.charts.netProfit")}</th></tr></thead>
            <tbody>{series.map((d) => <tr key={d.label}><td>{d.label}</td><td className="r">{formatMoney(d.revenue)}</td><td className="r">{formatMoney(d.gross_profit)}</td><td className="r">{formatMoney(d.net_profit)}</td></tr>)}</tbody></table>}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={series} margin={{ left: 4, right: 16, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={18} />
              <YAxis tick={AXIS} tickFormatter={formatCompact} axisLine={false} tickLine={false} width={48} />
              <ReferenceLine y={0} stroke="#bfae99" />
              <Tooltip content={<MoneyTooltip />} />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="revenue" name={t("admin.charts.revenue")} stroke={SERIES.s1} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="gross_profit" name={t("admin.charts.grossProfit")} stroke={SERIES.s2} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="net_profit" name={t("admin.charts.netProfit")} stroke={SERIES.s3} strokeWidth={2} strokeDasharray="5 3" dot={false} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={data.daily.length > 45 ? t("admin.charts.ordersWeekly") : t("admin.charts.orders")}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={series} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} minTickGap={18} />
              <YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} width={28} />
              <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(200,105,42,.08)" }} />
              <Bar dataKey="orders" name={t("admin.charts.ordersSeries")} fill={SERIES.s1} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t("admin.charts.byCategory")}
          table={<table className="table"><tbody>{catData.map((c) => <tr key={c.category}><td>{c.name}</td><td className="r">{c.quantity}</td><td className="r">{formatMoney(c.revenue)}</td><td className="r">{formatPercent(c.margin)}</td></tr>)}</tbody></table>}>
          <HBar data={catData} dataKey="revenue" />
        </ChartCard>

        <ChartCard title={t("admin.charts.topProducts")}>
          {top.length ? (
            <ResponsiveContainer width="100%" height={Math.max(180, top.length * 34)}>
              <BarChart data={top} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} width={150} axisLine={false} tickLine={false} />
                <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(200,105,42,.08)" }} />
                <Bar dataKey="quantity" name={t("admin.charts.units")} fill={SERIES.s2} radius={[0, 4, 4, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="muted chart-empty">{t("admin.charts.noData")}</p>}
        </ChartCard>

        <ChartCard title={t("admin.charts.profitable")}>
          <HBar data={profitable} dataKey="profit" color={SERIES.s3} label={t("admin.orders.profit")} />
        </ChartCard>

        <ChartCard title={t("admin.charts.expenses")}>
          <HBar data={expenses} dataKey="amount" color={SERIES.s1} label={t("admin.expenses.amount")} />
        </ChartCard>
      </div>

      <section className="panel">
        <div className="section__head section__head--tight"><h3>{t("admin.lowStockTitle")}</h3><Link to="/admin/purchases" className="link-arrow">{t("admin.purchases.add")} →</Link></div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>SKU</th><th>{t("admin.purchases.product")}</th><th className="r">{t("admin.stock")}</th><th className="r">{t("admin.reorder")}</th><th>{t("admin.purchases.supplier")}</th></tr></thead>
            <tbody>
              {data.low_stock.map((p) => (
                <tr key={p.product_id}>
                  <td className="mono">{p.sku}</td><td>{name(p)}</td>
                  <td className="r"><span className={`stock-badge stock-badge--${p.status}`}>{p.stock_qty}</span></td>
                  <td className="r">{p.reorder_level}</td><td className="muted">{p.supplier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
