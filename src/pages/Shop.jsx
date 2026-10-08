// Coffee Lab — catalog with search, category filter, sorting, stock filter
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { CATEGORY_KEYS, useStore } from "../context/StoreContext.jsx";
import ProductCard from "../components/ProductCard.jsx";
import { EmptyState, ErrorState, Notice, SkeletonGrid } from "../components/States.jsx";

function norm(s) { return String(s || "").toLowerCase(); }

export default function Shop() {
  const { t } = useI18n();
  const { products, status, offline, error, reload } = useStore();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const category = params.get("category") || "";
  const sort = params.get("sort") || "featured";
  const inStock = params.get("stock") === "1";

  const setParam = (k, v) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    setParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const c = {};
    products.forEach((p) => { c[p.category] = (c[p.category] || 0) + 1; });
    return c;
  }, [products]);

  const list = useMemo(() => {
    const q = norm(query).trim();
    const terms = q.split(/\s+/).filter(Boolean);
    let out = products.filter((p) => {
      if (category && p.category !== category) return false;
      if (inStock && p.stock_qty <= 0) return false;
      if (!terms.length) return true;
      const hay = norm([p.name_en, p.name_hy, p.sku, p.origin, p.description_en, p.description_hy, t(`categories.${p.category}`), p.roast_level, p.grind_type].join(" "));
      return terms.every((term) => hay.includes(term));
    });
    if (sort === "price-asc") out = [...out].sort((a, b) => a.sale_price - b.sale_price);
    else if (sort === "price-desc") out = [...out].sort((a, b) => b.sale_price - a.sale_price);
    else if (sort === "name") out = [...out].sort((a, b) => a.name_en.localeCompare(b.name_en));
    else out = [...out].sort((a, b) => (a.stock_qty <= 0) - (b.stock_qty <= 0));
    return out;
  }, [products, query, category, inStock, sort, t]);

  return (
    <section className="container page shop">
      <header className="page-head">
        <h1 className="display display--sm">{category ? t(`categories.${category}`) : t("shop.title")}</h1>
        <p className="muted">{t("shop.subtitle", { n: products.length })}</p>
      </header>

      {offline && <Notice tone="warn">{t("errors.offlineCatalog")} <button className="link-btn" onClick={() => reload()}>{t("common.retry")}</button></Notice>}

      <div className="shop__toolbar glass">
        <label className="search-field">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
          <input type="search" value={query} placeholder={t("shop.searchPlaceholder")} aria-label={t("common.search")}
            onChange={(e) => { setQuery(e.target.value); setParam("q", e.target.value); }} />
        </label>
        <label className="select-field">
          <span>{t("shop.sort")}</span>
          <select value={sort} onChange={(e) => setParam("sort", e.target.value === "featured" ? "" : e.target.value)}>
            <option value="featured">{t("shop.sortFeatured")}</option>
            <option value="price-asc">{t("shop.sortPriceAsc")}</option>
            <option value="price-desc">{t("shop.sortPriceDesc")}</option>
            <option value="name">{t("shop.sortName")}</option>
          </select>
        </label>
        <label className="check-field">
          <input type="checkbox" checked={inStock} onChange={(e) => setParam("stock", e.target.checked ? "1" : "")} />
          <span>{t("shop.inStockOnly")}</span>
        </label>
      </div>

      <div className="chips" role="tablist" aria-label={t("product.category")}>
        <button role="tab" aria-selected={!category} className={`chip ${!category ? "is-active" : ""}`} onClick={() => setParam("category", "")}>
          {t("common.all")} <span>{products.length}</span>
        </button>
        {CATEGORY_KEYS.map((k) => (
          <button key={k} role="tab" aria-selected={category === k} className={`chip ${category === k ? "is-active" : ""}`} onClick={() => setParam("category", k)}>
            {t(`categories.${k}`)} <span>{counts[k] || 0}</span>
          </button>
        ))}
      </div>

      {status === "loading" && <SkeletonGrid n={12} />}
      {status === "error" && <ErrorState error={error} onRetry={reload} />}
      {status === "empty" && <EmptyState title={t("shop.empty")} />}
      {(status === "ready" || status === "offline") && (
        <>
          <p className="muted shop__count">{t("shop.results", { n: list.length })}</p>
          {list.length ? (
            <div className="product-grid">{list.map((p) => <ProductCard key={p.product_id} product={p} />)}</div>
          ) : (
            <EmptyState title={t("shop.empty")} action={<button className="btn btn--ghost" onClick={() => { setQuery(""); setParams({}, { replace: true }); }}>{t("shop.clear")}</button>} />
          )}
        </>
      )}
    </section>
  );
}
