// Coffee Lab — product detail page
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import ProductArt from "../components/ProductArt.jsx";
import ProductCard from "../components/ProductCard.jsx";
import StockBadge from "../components/StockBadge.jsx";
import QuantityStepper from "../components/QuantityStepper.jsx";
import { EmptyState, Spinner } from "../components/States.jsx";
import { formatMoney, productDescription, productName, weightLabel } from "../utils/format.js";

export default function ProductDetail() {
  const { id } = useParams();
  const { t, lang } = useI18n();
  const { byId, products, status } = useStore();
  const { add, qtyOf } = useCart();
  const { notify } = useToast();
  const [qty, setQty] = useState(1);
  const p = byId[id];
  useEffect(() => setQty(1), [id]);

  if (status === "loading") return <Spinner />;
  if (!p) return <section className="container page"><EmptyState title={t("product.notFound")} action={<Link className="btn" to="/shop">{t("nav.shop")}</Link>} /></section>;

  const inCart = qtyOf(p.product_id);
  const maxAddable = Math.max(0, p.stock_qty - inCart);
  const out = p.stock_qty <= 0;
  const related = products.filter((x) => x.category === p.category && x.product_id !== p.product_id && x.stock_qty > 0).slice(0, 4);
  const specs = [
    ["product.category", t(`categories.${p.category}`)],
    ["product.origin", p.origin],
    ["product.roast", p.roast_level && t(`roast.${p.roast_level}`)],
    ["product.grind", p.grind_type && t(`grind.${p.grind_type}`)],
    ["product.weight", weightLabel(p, t)],
    ["product.sku", p.sku]
  ].filter(([, v]) => v);

  const onAdd = () => {
    const added = add(p, Math.min(qty, maxAddable));
    notify(added > 0 ? `${t("common.added")}: ${productName(p, lang)} × ${added}` : t("product.maxReached"), added > 0 ? "success" : "warn");
    setQty(1);
  };

  return (
    <section className="container page product-detail">
      <nav className="breadcrumbs">
        <Link to="/shop">{t("nav.shop")}</Link> / <Link to={`/shop?category=${p.category}`}>{t(`categories.${p.category}`)}</Link>
      </nav>
      <div className="product-detail__grid">
        <div className="product-detail__media"><ProductArt product={p} size="lg" /></div>
        <div className="product-detail__info">
          <p className="eyebrow">{t(`categories.${p.category}`)}</p>
          <h1 className="display display--sm">{productName(p, lang)}</h1>
          <p className="lead">{productDescription(p, lang)}</p>
          <div className="product-detail__price">
            <span className="price price--lg">{formatMoney(p.sale_price)}</span>
            {p.unit && <span className="muted">/ {t(`unit.${p.unit}`)}</span>}
          </div>
          <dl className="specs">
            {specs.map(([k, v]) => (<div key={k}><dt>{t(k)}</dt><dd>{v}</dd></div>))}
            <div><dt>{t("product.availability")}</dt><dd><StockBadge product={p} /></dd></div>
          </dl>
          <div className="product-detail__buy">
            <QuantityStepper value={qty} onChange={setQty} max={Math.max(1, maxAddable)} size="lg" />
            <button className="btn btn--lg" disabled={out || maxAddable <= 0} onClick={onAdd}>{t("common.addToCart")}</button>
          </div>
          {inCart > 0 && <p className="muted">{t("nav.cart")}: {inCart} · <Link to="/cart">{t("cart.checkout")} →</Link></p>}
        </div>
      </div>
      {related.length > 0 && (
        <div className="section">
          <div className="section__head"><h2>{t("product.related")}</h2></div>
          <div className="product-grid">{related.map((r) => <ProductCard key={r.product_id} product={r} />)}</div>
        </div>
      )}
    </section>
  );
}
