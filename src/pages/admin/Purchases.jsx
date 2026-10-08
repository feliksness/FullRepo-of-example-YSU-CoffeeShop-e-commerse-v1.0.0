// Coffee Lab — supplier purchases: stock ↑, INVENTORY_LOG entry, weighted-average cost update.
import { useMemo, useState } from "react";
import { useI18n } from "../../context/LanguageContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useStore } from "../../context/StoreContext.jsx";
import { addPurchase, getAdminProducts, getPurchases } from "../../api/endpoints.js";
import useAdminQuery, { useAdminAction } from "../../hooks/useAdminQuery.js";
import { formatDate, formatMoney, productName, toDateInput } from "../../utils/format.js";
import { errorMessage } from "../../utils/errors.js";
import { Spinner } from "../../components/States.jsx";
import { AdminError } from "./ui.jsx";

export default function Purchases() {
  const { t, lang } = useI18n();
  const { notify } = useToast();
  const { reload: reloadStore } = useStore();
  const [run, busy] = useAdminAction();
  const products = useAdminQuery((pin) => getAdminProducts(pin));
  const history = useAdminQuery((pin) => getPurchases(pin, {}));
  const [form, setForm] = useState({ product_id: "", quantity: "", unit_cost: "", supplier: "", invoice_reference: "", notes: "", purchase_date: toDateInput(new Date()) });
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const plist = useMemo(() => (products.data?.products || []).slice().sort((a, b) => a.stock_qty - a.reorder_level - (b.stock_qty - b.reorder_level)), [products.data]);
  const sel = plist.find((p) => p.product_id === form.product_id);
  const qty = Number(form.quantity), cost = Number(form.unit_cost);
  const preview = sel && qty > 0 && cost > 0 ? {
    stock: sel.stock_qty + qty,
    cost: (Math.max(0, sel.stock_qty) * sel.unit_cost + qty * cost) / (Math.max(0, sel.stock_qty) + qty)
  } : null;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const choose = (e) => {
    const p = plist.find((x) => x.product_id === e.target.value);
    setForm((f) => ({ ...f, product_id: e.target.value, supplier: p ? p.supplier : "", unit_cost: p ? String(Math.round(p.unit_cost)) : "" }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    try {
      const r = await run((pin) => addPurchase(pin, { ...form, quantity: qty, unit_cost: cost }));
      setResult(r.inventory);
      notify(t("admin.purchases.done", { a: r.inventory.stock_before, b: r.inventory.stock_after, c: formatMoney(r.inventory.cost_before), d: formatMoney(r.inventory.cost_after) }), "success", 7000);
      setForm((f) => ({ ...f, quantity: "", invoice_reference: "", notes: "" }));
      products.reload();
      history.reload();
      reloadStore(true);
    } catch (e2) { setErr(e2); }
  };

  return (
    <div className="split">
      <form className="panel" onSubmit={submit}>
        <h3>{t("admin.purchases.add")}</h3>
        {products.loading && !products.data ? <Spinner /> : (
          <>
            <div className="field">
              <label>{t("admin.purchases.product")}</label>
              <select required value={form.product_id} onChange={choose}>
                <option value="">{t("admin.purchases.choose")}</option>
                {plist.map((p) => <option key={p.product_id} value={p.product_id}>{p.stock_qty <= p.reorder_level ? "⚠ " : ""}{p.sku} · {productName(p, lang)} ({p.stock_qty})</option>)}
              </select>
            </div>
            <div className="form-grid">
              <div className="field"><label>{t("admin.purchases.quantity")}</label><input required type="number" min="1" step="1" value={form.quantity} onChange={set("quantity")} /></div>
              <div className="field"><label>{t("admin.purchases.unitCost")} (֏)</label><input required type="number" min="1" step="0.01" value={form.unit_cost} onChange={set("unit_cost")} /></div>
              <div className="field"><label>{t("admin.purchases.supplier")}</label><input value={form.supplier} onChange={set("supplier")} /></div>
              <div className="field"><label>{t("admin.purchases.date")}</label><input type="date" value={form.purchase_date} onChange={set("purchase_date")} /></div>
              <div className="field"><label>{t("admin.purchases.invoice")}</label><input value={form.invoice_reference} onChange={set("invoice_reference")} /></div>
              <div className="field"><label>{t("admin.purchases.notes")}</label><input value={form.notes} onChange={set("notes")} /></div>
            </div>
            {sel && (
              <div className="wac-preview">
                <div><span>{t("admin.purchases.currentStock")}</span><strong>{sel.stock_qty}</strong></div>
                <div><span>{t("admin.purchases.currentCost")}</span><strong>{formatMoney(sel.unit_cost)}</strong></div>
                <div><span>{t("admin.purchases.totalCost")}</span><strong>{preview ? formatMoney(qty * cost) : "—"}</strong></div>
                <div className="wac-preview__new"><span>{t("admin.purchases.newStock")}</span><strong>{preview ? preview.stock : "—"}</strong></div>
                <div className="wac-preview__new"><span>{t("admin.purchases.newCost")}</span><strong>{preview ? formatMoney(preview.cost) : "—"}</strong></div>
              </div>
            )}
            {err && <div className="notice notice--error">{errorMessage(err, t)}</div>}
            {result && <div className="notice notice--success">{t("admin.purchases.done", { a: result.stock_before, b: result.stock_after, c: formatMoney(result.cost_before), d: formatMoney(result.cost_after) })}</div>}
            <button className="btn btn--block" disabled={busy || !form.product_id}>{busy ? t("common.loading") : t("admin.purchases.submit")}</button>
          </>
        )}
      </form>
      <section className="panel panel--flush">
        <div className="admin-toolbar admin-toolbar--in"><h3>{t("admin.purchases.history")}</h3>{history.data && <span className="muted small">{formatMoney(history.data.total_cost)}</span>}</div>
        <AdminError error={history.error} onRetry={history.reload} />
        <div className="table-wrap table-wrap--tall">
          <table className="table table--compact">
            <thead><tr><th>ID</th><th>{t("admin.purchases.date")}</th><th>{t("admin.purchases.product")}</th><th className="r">{t("admin.purchases.quantity")}</th><th className="r">{t("admin.purchases.unitCost")}</th><th className="r">{t("admin.purchases.totalCost")}</th><th>{t("admin.purchases.supplier")}</th></tr></thead>
            <tbody>
              {(history.data?.purchases || []).map((p) => (
                <tr key={p.purchase_id}>
                  <td className="mono small">{p.purchase_id}</td><td className="small">{formatDate(p.purchase_date, lang)}</td>
                  <td>{productName(p, lang)}</td><td className="r">{p.quantity}</td><td className="r">{formatMoney(p.unit_cost)}</td>
                  <td className="r">{formatMoney(p.total_cost)}</td><td className="muted small">{p.supplier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
