// Coffee Lab — inventory valuation and movement log (PURCHASE / SALE / ADJUSTMENT / RETURN)
import { useMemo, useState } from "react";
import { useI18n } from "../../context/LanguageContext.jsx";
import { getInventory } from "../../api/endpoints.js";
import useAdminQuery from "../../hooks/useAdminQuery.js";
import { formatDate, formatMoney, productName } from "../../utils/format.js";
import { Spinner } from "../../components/States.jsx";
import { AdminError, Kpi } from "./ui.jsx";

export default function Inventory() {
  const { t, lang } = useI18n();
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const { data, error, loading, reload } = useAdminQuery((pin) => getInventory(pin));
  const names = useMemo(() => Object.fromEntries((data?.products || []).map((p) => [p.product_id, productName(p, lang)])), [data, lang]);
  const products = useMemo(() => (data?.products || []).filter((p) => !q || `${p.sku} ${p.name_en} ${p.name_hy}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.inventory_value - a.inventory_value), [data, q]);
  if (!data && loading) return <Spinner />;
  if (!data) return <AdminError error={error} onRetry={reload} />;
  const s = data.summary;
  const moves = data.movements.filter((m) => !type || m.movement_type === type);

  return (
    <div>
      <div className="kpi-grid kpi-grid--4">
        <Kpi label={t("admin.inventory.value")} value={formatMoney(s.inventory_value)} />
        <Kpi label={t("admin.inventory.units")} value={s.units_in_stock} />
        <Kpi label={t("admin.kpi.lowStock")} value={s.low_stock_count} tone={s.low_stock_count ? "warn" : ""} />
        <Kpi label={t("admin.kpi.outOfStock")} value={s.out_of_stock_count} tone={s.out_of_stock_count ? "neg" : ""} />
      </div>
      <div className="inventory-grid">
        <section className="panel panel--flush">
          <div className="admin-toolbar admin-toolbar--in">
            <input className="input" type="search" placeholder={t("admin.products.search")} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="table-wrap table-wrap--tall">
            <table className="table">
              <thead><tr><th>SKU</th><th>{t("admin.purchases.product")}</th><th className="r">{t("admin.stock")}</th><th className="r">{t("admin.products.cost")}</th><th className="r">{t("admin.inventory.value")}</th></tr></thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.product_id}>
                    <td className="mono small">{p.sku}</td><td>{productName(p, lang)}</td>
                    <td className="r"><span className={`stock-badge stock-badge--${p.stock_status}`}>{p.stock_qty}</span></td>
                    <td className="r">{formatMoney(p.unit_cost)}</td><td className="r">{formatMoney(p.inventory_value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="panel panel--flush">
          <div className="admin-toolbar admin-toolbar--in">
            <h3>{t("admin.inventory.movements")}</h3>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">{t("common.all")}</option>
              {["PURCHASE", "SALE", "ADJUSTMENT", "RETURN"].map((m) => <option key={m} value={m}>{t(`admin.inventory.${m}`)}</option>)}
            </select>
          </div>
          <div className="table-wrap table-wrap--tall">
            <table className="table table--compact">
              <thead><tr><th>{t("admin.reports.date")}</th><th>{t("admin.purchases.product")}</th><th>{t("admin.inventory.type")}</th><th className="r">{t("admin.inventory.change")}</th><th className="r">{t("admin.inventory.after")}</th><th>{t("admin.inventory.ref")}</th></tr></thead>
              <tbody>
                {moves.map((m) => (
                  <tr key={m.movement_id}>
                    <td className="small">{formatDate(m.date, lang)}</td>
                    <td>{names[m.product_id] || m.sku}</td>
                    <td><span className={`move move--${m.movement_type}`}>{t(`admin.inventory.${m.movement_type}`)}</span></td>
                    <td className={`r mono ${m.quantity_change < 0 ? "neg" : "pos"}`}>{m.quantity_change > 0 ? "+" : ""}{m.quantity_change}</td>
                    <td className="r">{m.stock_before} → {m.stock_after}</td>
                    <td className="mono small">{m.reference_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
