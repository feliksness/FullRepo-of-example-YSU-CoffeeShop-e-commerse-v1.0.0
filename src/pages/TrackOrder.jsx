// Coffee Lab — public order lookup (order ID + email)
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { getOrder } from "../api/endpoints.js";
import { KEYS, load } from "../utils/storage.js";
import { errorMessage } from "../utils/errors.js";
import { formatDate, formatMoney, productName } from "../utils/format.js";
import { Notice } from "../components/States.jsx";

const FLOW = ["NEW", "CONFIRMED", "SHIPPED", "DELIVERED"];

export default function TrackOrder() {
  const { t, lang } = useI18n();
  const [params] = useSearchParams();
  const last = load(KEYS.lastOrder, null);
  const [orderId, setOrderId] = useState(params.get("order") || last?.order_id || "");
  const [email, setEmail] = useState(last?.customer?.email || load(KEYS.draft, {}).form?.email || "");
  const [state, setState] = useState({ loading: false, order: null, error: null });

  const find = async (e) => {
    e.preventDefault();
    if (!orderId.trim() || !email.trim()) return;
    setState({ loading: true, order: null, error: null });
    try {
      const data = await getOrder(orderId.trim(), email.trim());
      setState({ loading: false, order: data.order, error: null });
    } catch (err) {
      setState({ loading: false, order: null, error: err });
    }
  };
  const o = state.order;
  const step = o ? FLOW.indexOf(o.order_status) : -1;

  return (
    <section className="container page track">
      <header className="page-head">
        <h1 className="display display--sm">{t("track.title")}</h1>
        <p className="muted">{t("track.subtitle")}</p>
      </header>
      <form className="panel track__form" onSubmit={find}>
        <div className="field"><label htmlFor="oid">{t("track.orderId")}</label><input id="oid" className="mono" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="ORD-20261008-0001" /></div>
        <div className="field"><label htmlFor="oemail">{t("track.email")}</label><input id="oemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <button className="btn" disabled={state.loading}>{state.loading ? t("common.loading") : t("track.find")}</button>
      </form>
      {state.error && <Notice tone="error">{state.error.code === "ORDER_NOT_FOUND" ? t("track.notFound") : errorMessage(state.error, t)}</Notice>}
      {o && (
        <div className="panel track__result">
          <div className="track__head">
            <strong className="mono">{o.order_id}</strong>
            <span className="muted">{t("track.placed")}: {formatDate(o.order_date, lang, true)}</span>
          </div>
          {o.order_status === "CANCELLED" ? (
            <span className="status status--CANCELLED">{t("status.CANCELLED")}</span>
          ) : (
            <ol className="progress">
              {FLOW.map((s, i) => <li key={s} className={i <= step ? "is-done" : ""}><span />{t(`status.${s}`)}</li>)}
            </ol>
          )}
          <ul className="summary__lines">
            {o.items.map((it) => <li key={it.product_id}><span>{productName(it, lang)} <span className="muted">× {it.quantity}</span></span><span>{formatMoney(it.line_total)}</span></li>)}
          </ul>
          <div className="summary__total summary-dl"><div><dt>{t("cart.total")}</dt><dd>{formatMoney(o.total_amount)}</dd></div></div>
        </div>
      )}
    </section>
  );
}
