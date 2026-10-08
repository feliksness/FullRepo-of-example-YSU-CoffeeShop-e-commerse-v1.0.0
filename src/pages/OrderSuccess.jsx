// Coffee Lab — order confirmation (data returned by Apps Script, cached as "last order").
import { useState } from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { KEYS, load } from "../utils/storage.js";
import { formatDate, formatMoney, productName } from "../utils/format.js";
import { MiniMap } from "../components/MapPicker.jsx";
import { EmptyState } from "../components/States.jsx";

export default function OrderSuccess() {
  const { t, lang } = useI18n();
  const order = load(KEYS.lastOrder, null);
  const [copied, setCopied] = useState(false);
  if (!order) return <section className="container page"><EmptyState title={t("success.noOrder")} action={<Link className="btn" to="/shop">{t("nav.shop")}</Link>} /></section>;

  const copy = async () => {
    try { await navigator.clipboard.writeText(order.order_id); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <section className="container page success">
      <div className="success__hero">
        <div className="success__check" aria-hidden="true">✓</div>
        <h1 className="display display--sm">{t("success.title")}</h1>
        <p className="lead">{t("success.subtitle")}</p>
        <div className="order-id">
          <span className="muted">{t("success.orderId")}</span>
          <strong className="mono">{order.order_id}</strong>
          <button className="btn btn--ghost btn--sm" onClick={copy}>{copied ? t("success.copied") : t("success.copy")}</button>
        </div>
      </div>
      <div className="success__grid">
        <div className="panel">
          <dl className="kv">
            <div><dt>{t("track.placed")}</dt><dd>{formatDate(order.order_date, lang, true)}</dd></div>
            <div><dt>{t("success.status")}</dt><dd><span className={`status status--${order.order_status}`}>{t(`status.${order.order_status}`)}</span></dd></div>
            <div><dt>{t("success.payment")}</dt><dd>{t(`status.${order.payment_method}`)} · {t(`status.${order.payment_status}`)}</dd></div>
            <div><dt>{t("success.deliverTo")}</dt><dd>{order.delivery?.address}</dd></div>
          </dl>
          <MiniMap lat={order.delivery?.latitude} lng={order.delivery?.longitude} />
        </div>
        <div className="panel">
          <ul className="summary__lines">
            {order.items.map((it) => (
              <li key={it.product_id}><span>{productName(it, lang)} <span className="muted">× {it.quantity}</span></span><span>{formatMoney(it.line_total)}</span></li>
            ))}
          </ul>
          <dl className="summary-dl">
            <div><dt>{t("cart.subtotal")}</dt><dd>{formatMoney(order.subtotal)}</dd></div>
            {order.discount > 0 && <div><dt>{t("cart.discount", { rate: Math.round((order.discount / order.subtotal) * 100) })}</dt><dd>{formatMoney(-order.discount)}</dd></div>}
            <div><dt>{t("cart.delivery")}</dt><dd>{order.delivery_fee ? formatMoney(order.delivery_fee) : t("cart.free")}</dd></div>
            <div className="summary__total"><dt>{t("cart.total")}</dt><dd>{formatMoney(order.total_amount)}</dd></div>
          </dl>
          <div className="success__actions">
            <Link className="btn" to={`/track?order=${order.order_id}`}>{t("success.track")}</Link>
            <Link className="btn btn--ghost" to="/shop">{t("success.keepShopping")}</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
