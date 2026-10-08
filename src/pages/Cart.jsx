// Coffee Lab — cart page (LocalStorage-backed)
import { Link, useNavigate } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import useCartLines from "../hooks/useCartLines.js";
import ProductArt from "../components/ProductArt.jsx";
import QuantityStepper from "../components/QuantityStepper.jsx";
import CartSummary from "../components/CartSummary.jsx";
import { EmptyState, Notice } from "../components/States.jsx";
import { formatMoney, productName } from "../utils/format.js";

export default function Cart() {
  const { t, lang } = useI18n();
  const { setQty, remove, clear, count } = useCart();
  const { offline } = useStore();
  const { lines, totals, settings, hasProblems } = useCartLines();
  const navigate = useNavigate();

  if (!lines.length) {
    return (
      <section className="container page">
        <h1 className="display display--sm">{t("cart.title")}</h1>
        <EmptyState title={t("cart.empty")} action={<Link className="btn" to="/shop">{t("cart.emptyCta")}</Link>} />
      </section>
    );
  }

  return (
    <section className="container page cart">
      <header className="page-head page-head--row">
        <div>
          <h1 className="display display--sm">{t("cart.title")}</h1>
          <p className="muted">{count === 1 ? t("common.item") : t("common.items", { n: count })} · {t("cart.persisted")}</p>
        </div>
        <button className="btn btn--ghost btn--sm" onClick={clear}>{t("cart.clear")}</button>
      </header>
      {offline && <Notice tone="warn">{t("errors.offlineCheckout")}</Notice>}
      <div className="cart__grid">
        <ul className="cart-lines">
          {lines.map((l) => (
            <li key={l.product_id} className={`cart-line ${l.problem ? "has-problem" : ""}`}>
              <Link to={`/product/${l.product_id}`} className="cart-line__art">{l.product ? <ProductArt product={l.product} size="sm" /> : null}</Link>
              <div className="cart-line__info">
                <Link to={`/product/${l.product_id}`} className="cart-line__name">{l.product ? productName(l.product, lang) : l.product_id}</Link>
                <span className="muted">{l.product ? `${formatMoney(l.price)} ${t("common.perUnit")}` : ""}</span>
                {l.problem === "unavailable" && <span className="cart-line__problem">{t("cart.unavailable")}</span>}
                {l.problem === "reduced" && (
                  <span className="cart-line__problem">
                    {t("cart.reduced", { n: l.available })}{" "}
                    <button className="link-btn" onClick={() => setQty(l.product_id, l.available)}>✓</button>
                  </span>
                )}
              </div>
              <QuantityStepper value={l.quantity} max={Math.max(1, Math.min(99, l.available || l.quantity))} onChange={(q) => setQty(l.product_id, q)} size="sm" />
              <strong className="cart-line__total">{formatMoney(l.price * l.quantity)}</strong>
              <button className="cart-line__remove" aria-label={t("common.remove")} title={t("common.remove")} onClick={() => remove(l.product_id)}>✕</button>
            </li>
          ))}
        </ul>
        <CartSummary totals={totals} settings={settings}>
          <button className="btn btn--lg btn--block" disabled={hasProblems || offline || totals.units === 0} onClick={() => navigate("/checkout")}>
            {t("cart.checkout")} →
          </button>
          <Link to="/shop" className="btn btn--ghost btn--block">{t("cart.continue")}</Link>
        </CartSummary>
      </div>
    </section>
  );
}
