// Coffee Lab — admin products: create, edit, activate/deactivate, price, stock adjustment.
import { useMemo, useState } from "react";
import { useI18n } from "../../context/LanguageContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { CATEGORY_KEYS, useStore } from "../../context/StoreContext.jsx";
import { createProduct, getAdminProducts, updateProduct } from "../../api/endpoints.js";
import useAdminQuery, { useAdminAction } from "../../hooks/useAdminQuery.js";
import { formatMoney, formatPercent, productName } from "../../utils/format.js";
import { errorMessage } from "../../utils/errors.js";
import Modal from "../../components/Modal.jsx";
import ProductArt from "../../components/ProductArt.jsx";
import { Spinner } from "../../components/States.jsx";
import { AdminError } from "./ui.jsx";

const ROASTS = ["", "light", "medium-light", "medium", "medium-dark", "dark"];
const GRINDS = ["", "whole-bean", "espresso", "filter", "french-press", "turkish", "moka", "pour-over", "universal", "instant", "powder"];
const UNITS = ["bag", "jar", "bottle", "pack", "box", "pcs"];
const BLANK = { sku: "", category: "coffee-beans", name_hy: "", name_en: "", description_hy: "", description_en: "", origin: "", roast_level: "",
  grind_type: "", weight_g: 250, unit: "bag", sale_price: "", unit_cost: "", stock_qty: 0, reorder_level: 5, supplier: "", image_url: "", active: true };

function ProductForm({ product, onClose, onSaved }) {
  const { t } = useI18n();
  const { notify } = useToast();
  const [run, busy] = useAdminAction();
  const isNew = !product;
  const [f, setF] = useState(() => (product ? { ...product, image_url: /^https?:/.test(product.image_url) ? product.image_url : "" } : BLANK));
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    const payload = {
      sku: f.sku, category: f.category, name_hy: f.name_hy, name_en: f.name_en, description_hy: f.description_hy,
      description_en: f.description_en, origin: f.origin, roast_level: f.roast_level, grind_type: f.grind_type,
      weight_g: Number(f.weight_g) || 0, unit: f.unit, sale_price: Number(f.sale_price), reorder_level: Number(f.reorder_level) || 0,
      supplier: f.supplier, image_url: f.image_url || `art:${f.category}`, active: !!f.active
    };
    if (isNew) { payload.stock_qty = Number(f.stock_qty) || 0; payload.unit_cost = Number(f.unit_cost) || 0; }
    else if (Number(f.stock_qty) !== product.stock_qty) payload.stock_qty = Number(f.stock_qty);
    try {
      await run((pin) => (isNew ? createProduct(pin, payload) : updateProduct(pin, product.product_id, payload)));
      notify(isNew ? t("admin.products.created") : t("admin.products.saved"), "success");
      onSaved();
      onClose();
    } catch (e2) {
      setErr(e2);
    }
  };

  const margin = Number(f.sale_price) > 0 && Number(f.unit_cost) > 0 ? ((Number(f.sale_price) - Number(f.unit_cost)) / Number(f.sale_price)) * 100 : null;

  return (
    <Modal title={isNew ? t("admin.products.add") : `${t("admin.products.edit")} · ${product.sku}`} onClose={onClose} wide>
      <form className="product-form" onSubmit={submit}>
        <div className="form-grid form-grid--3">
          <div className="field"><label>{t("admin.products.sku")}</label><input required value={f.sku} onChange={set("sku")} className="mono" /></div>
          <div className="field"><label>{t("admin.products.category")}</label>
            <select value={f.category} onChange={set("category")}>{CATEGORY_KEYS.map((k) => <option key={k} value={k}>{t(`categories.${k}`)}</option>)}</select></div>
          <div className="field field--check"><label><input type="checkbox" checked={!!f.active} onChange={set("active")} /> {t("admin.products.active")}</label></div>
          <div className="field"><label>{t("admin.products.nameHy")}</label><input required value={f.name_hy} onChange={set("name_hy")} /></div>
          <div className="field"><label>{t("admin.products.nameEn")}</label><input required value={f.name_en} onChange={set("name_en")} /></div>
          <div className="field"><label>{t("admin.products.supplier")}</label><input value={f.supplier} onChange={set("supplier")} /></div>
          <div className="field field--span2"><label>{t("admin.products.descHy")}</label><textarea rows={2} value={f.description_hy} onChange={set("description_hy")} /></div>
          <div className="field"><label>{t("admin.products.origin")}</label><input value={f.origin} onChange={set("origin")} /></div>
          <div className="field field--span2"><label>{t("admin.products.descEn")}</label><textarea rows={2} value={f.description_en} onChange={set("description_en")} /></div>
          <div className="field"><label>{t("admin.products.roast")}</label>
            <select value={f.roast_level} onChange={set("roast_level")}>{ROASTS.map((r) => <option key={r} value={r}>{r ? t(`roast.${r}`) : "—"}</option>)}</select></div>
          <div className="field"><label>{t("admin.products.grind")}</label>
            <select value={f.grind_type} onChange={set("grind_type")}>{GRINDS.map((r) => <option key={r} value={r}>{r ? t(`grind.${r}`) : "—"}</option>)}</select></div>
          <div className="field"><label>{t("admin.products.weight")}</label><input type="number" min="0" value={f.weight_g} onChange={set("weight_g")} /></div>
          <div className="field"><label>{t("admin.products.unit")}</label>
            <select value={f.unit} onChange={set("unit")}>{UNITS.map((u) => <option key={u} value={u}>{t(`unit.${u}`)}</option>)}</select></div>
          <div className="field"><label>{t("admin.products.price")} (֏)</label><input required type="number" min="1" value={f.sale_price} onChange={set("sale_price")} /></div>
          <div className="field">
            <label>{isNew ? t("admin.products.openingCost") : t("admin.products.cost")} (֏)</label>
            <input type="number" min="0" step="0.01" value={f.unit_cost} onChange={set("unit_cost")} disabled={!isNew} />
            {!isNew && <span className="field__hint">{t("admin.products.costHint")}</span>}
          </div>
          <div className="field"><label>{t("admin.products.reorder")}</label><input type="number" min="0" value={f.reorder_level} onChange={set("reorder_level")} /></div>
          <div className="field">
            <label>{isNew ? t("admin.products.openingStock") : t("admin.products.stock")}</label>
            <input type="number" min="0" step="1" value={f.stock_qty} onChange={set("stock_qty")} />
            {!isNew && <span className="field__hint">{t("admin.products.stockHint")}</span>}
          </div>
          <div className="field field--span2"><label>{t("admin.products.image")}</label><input value={f.image_url} onChange={set("image_url")} placeholder="https://…" />
            <span className="field__hint">{t("admin.products.imageHint")}</span></div>
          <div className="product-form__preview">
            <ProductArt product={{ ...f, image_url: f.image_url || `art:${f.category}` }} size="sm" />
            {margin !== null && <span className="mono small">{t("admin.products.margin")}: {formatPercent(margin)}</span>}
          </div>
        </div>
        {err && <div className="notice notice--error">{errorMessage(err, t)}{err.details?.field ? ` (${err.details.field})` : ""}</div>}
        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onClose}>{t("common.cancel")}</button>
          <button className="btn" disabled={busy}>{busy ? t("common.loading") : isNew ? t("common.create") : t("common.save")}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function Products() {
  const { t, lang } = useI18n();
  const { notify } = useToast();
  const { reload: reloadStore } = useStore();
  const [run] = useAdminAction();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState(undefined); // undefined = closed, null = new
  const { data, error, loading, reload } = useAdminQuery((pin) => getAdminProducts(pin));
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.products || []).filter((p) => (!cat || p.category === cat) && (!q || `${p.sku} ${p.name_en} ${p.name_hy}`.toLowerCase().includes(q)));
  }, [data, search, cat]);

  const saved = () => { reload(); reloadStore(true); };
  const toggle = async (p) => {
    try {
      await run((pin) => updateProduct(pin, p.product_id, { active: !p.active }));
      notify(t("admin.products.saved"), "success");
      saved();
    } catch (err) { notify(errorMessage(err, t), "error"); }
  };

  return (
    <div>
      <div className="admin-toolbar">
        <input className="input" type="search" placeholder={t("admin.products.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">{t("common.all")}</option>
          {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{t(`categories.${k}`)}</option>)}
        </select>
        <span className="muted small">{list.length}</span>
        <button className="btn btn--sm toolbar-right" onClick={() => setEditing(null)}>+ {t("admin.products.add")}</button>
      </div>
      <AdminError error={error} onRetry={reload} />
      {!data && loading ? <Spinner /> : (
        <div className="table-wrap panel panel--flush">
          <table className="table table--hover">
            <thead><tr><th>SKU</th><th>{t("admin.purchases.product")}</th><th className="r">{t("admin.products.price")}</th><th className="r">{t("admin.orders.cost")}</th><th className="r">{t("admin.products.margin")}</th><th className="r">{t("admin.products.stock")}</th><th className="r">{t("admin.products.reorder")}</th><th>{t("admin.products.status")}</th><th /></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.product_id} className={p.active ? "" : "is-muted"}>
                  <td className="mono small">{p.sku}</td>
                  <td>{productName(p, lang)}<div className="muted small">{t(`categories.${p.category}`)}</div></td>
                  <td className="r">{formatMoney(p.sale_price)}</td>
                  <td className="r">{formatMoney(p.unit_cost)}</td>
                  <td className="r">{formatPercent(p.margin_percent)}</td>
                  <td className="r"><span className={`stock-badge stock-badge--${p.stock_status}`}>{p.stock_qty}</span></td>
                  <td className="r">{p.reorder_level}</td>
                  <td><button className={`toggle ${p.active ? "is-on" : ""}`} onClick={() => toggle(p)} title={p.active ? t("admin.products.deactivate") : t("admin.products.activate")}>{p.active ? t("admin.products.active") : t("admin.products.inactive")}</button></td>
                  <td><button className="btn btn--ghost btn--sm" onClick={() => setEditing(p)}>{t("common.edit")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing !== undefined && <ProductForm product={editing} onClose={() => setEditing(undefined)} onSaved={saved} />}
    </div>
  );
}
