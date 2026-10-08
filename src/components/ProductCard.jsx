// Coffee Lab — catalog card
import { Link } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import { formatMoney, productName, weightLabel } from "../utils/format.js";
import ProductArt from "./ProductArt.jsx";
import StockBadge from "./StockBadge.jsx";

export default function ProductCard({ product }) {
  const { t, lang } = useI18n();
  const { add, qtyOf } = useCart();
  const { notify } = useToast();
  const out = product.stock_qty <= 0;
  const inCart = qtyOf(product.product_id);
  const meta = [
    product.roast_level ? t(`roast.${product.roast_level}`) : null,
    weightLabel(product, t)
  ].filter(Boolean).join(" · ");

  const onAdd = () => {
    const added = add(product, 1);
    notify(added > 0 ? `${t("common.added")}: ${productName(product, lang)}` : t("product.maxReached"), added > 0 ? "success" : "warn");
  };

  return (
    <article className={`product-card ${out ? "is-out" : ""}`}>
      <Link to={`/product/${product.product_id}`} className="product-card__media" aria-label={productName(product, lang)}>
        <ProductArt product={product} />
        <span className="product-card__cat">{t(`categories.${product.category}`)}</span>
      </Link>
      <div className="product-card__body">
        <Link to={`/product/${product.product_id}`} className="product-card__name">{productName(product, lang)}</Link>
        <p className="product-card__meta">{product.origin ? <span>{product.origin}</span> : null}{meta && <span>{meta}</span>}</p>
        <div className="product-card__foot">
          <div>
            <div className="price">{formatMoney(product.sale_price)}</div>
            <StockBadge product={product} />
          </div>
          <button type="button" className="btn btn--icon" disabled={out} onClick={onAdd} aria-label={t("common.addToCart")} title={t("common.addToCart")}>
            {inCart > 0 ? <span className="btn__count">{inCart}</span> : null}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
          </button>
        </div>
      </div>
    </article>
  );
}
