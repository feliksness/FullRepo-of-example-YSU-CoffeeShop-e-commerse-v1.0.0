// Coffee Lab — admin orders: search, filter, details, status changes, delivery map.
import { useMemo, useState } from "react";
import { useI18n } from "../../context/LanguageContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useStore } from "../../context/StoreContext.jsx";
import { getOrders, updateOrderStatus } from "../../api/endpoints.js";
import useAdminQuery, { useAdminAction } from "../../hooks/useAdminQuery.js";
import { formatDate, formatMoney, formatPercent, productName } from "../../utils/format.js";
import { errorMessage } from "../../utils/errors.js";
import Modal from "../../components/Modal.jsx";
import { MiniMap } from "../../components/MapPicker.jsx";
import { Spinner } from "../../components/States.jsx";
import { AdminError, StatusPill } from "./ui.jsx";

const STATUSES = ["NEW", "CONFIRMED", "SHIPPED", "DELIVERED", "CANCELLED"];

function OrderDetail({ order, onClose, onChanged }) {
  const { t, lang } = useI18n();
  const { notify } = useToast();
  const { reload: reloadStore } = useStore();
  const [run, busy] = useAdminAction();
  const [status, setStatus] = useState(order.order_status);
  const locked = order.order_status === "CANCELLED";

  const save = async () => {
    try {
      await run((pin) => updateOrderStatus(pin, order.order_id, status));
      notify(t("admin.orders.updated"), "success");
      if (status === "CANCELLED") reloadStore(true);
      onChanged();
      onClose();
    } catch (err) {
      notify(errorMessage(err, t), "error");
    }
  };

  return (
    <Modal title={`${t("admin.orders.detail")} ${order.order_id}`} onClose={onClose} wide>
      <div className="order-detail">
        <div>
          <dl className="kv">
            <div><dt>{t("admin.orders.date")}</dt><dd>{formatDate(order.order_date, lang, true)}</dd></div>
            <div><dt>{t("admin.orders.customer")}</dt><dd>{order.customer_name}{order.company ? ` · ${order.company}` : ""}</dd></div>
            <div><dt>{t("checkout.email")}</dt><dd><a href={`mailto:${order.customer_email}`}>{order.customer_email}</a></dd></div>
            <div><dt>{t("checkout.phone")}</dt><dd><a href={`tel:${order.customer_phone.replace(/\s/g, "")}`}>{order.customer_phone}</a></dd></div>
            <div><dt>{t("checkout.address")}</dt><dd>{order.delivery_address}</dd></div>
            {order.delivery_notes && <div><dt>{t("checkout.notes")}</dt><dd>{order.delivery_notes}</dd></div>}
            <div><dt>{t("success.payment")}</dt><dd>{t(`status.${order.payment_method}`)} · <StatusPill status={order.payment_status} /></dd></div>
          </dl>
          <h4>{t("admin.orders.location")}</h4>
          <MiniMap lat={order.delivery_latitude} lng={order.delivery_longitude} height={200} />
          <a className="link-arrow small" target="_blank" rel="noreferrer"
            href={`https://www.openstreetmap.org/?mlat=${order.delivery_latitude}&mlon=${order.delivery_longitude}#map=17/${order.delivery_latitude}/${order.delivery_longitude}`}>
            {t("admin.orders.openOsm")} ↗ <span className="mono">({order.delivery_latitude}, {order.delivery_longitude})</span>
          </a>
        </div>
        <div>
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>{t("admin.purchases.product")}</th><th className="r">{t("common.qty")}</th><th className="r">{t("admin.products.price")}</th><th className="r">{t("admin.orders.cost")}</th><th className="r">{t("admin.orders.profit")}</th></tr></thead>
              <tbody>
                {order.items.map((it) => (
                  <tr key={it.product_id}>
                    <td>{productName(it, lang)}<div className="mono muted small">{it.sku}</div></td>
                    <td className="r">{it.quantity}</td><td className="r">{formatMoney(it.unit_price)}</td>
                    <td className="r">{formatMoney(it.unit_cost)}</td><td className="r">{formatMoney(it.line_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="summary-dl">
            <div><dt>{t("cart.subtotal")}</dt><dd>{formatMoney(order.subtotal)}</dd></div>
            <div><dt>{t("admin.kpi.discounts")}</dt><dd>{formatMoney(-order.discount)}</dd></div>
            <div><dt>{t("cart.delivery")}</dt><dd>{formatMoney(order.delivery_fee)}</dd></div>
            <div className="summary__total"><dt>{t("cart.total")}</dt><dd>{formatMoney(order.total_amount)}</dd></div>
            <div><dt>COGS</dt><dd>{formatMoney(order.total_cogs)}</dd></div>
            <div><dt>{t("admin.kpi.grossProfit")}</dt><dd>{formatMoney(order.gross_profit)} · {formatPercent(order.gross_margin_percent)}</dd></div>
          </dl>
          <div className="status-editor">
            <label htmlFor="ost">{t("admin.orders.changeStatus")}</label>
            <div className="status-editor__row">
              <select id="ost" value={status} disabled={locked} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
              </select>
              <button className="btn" disabled={busy || locked || status === order.order_status} onClick={save}>{busy ? t("common.loading") : t("admin.orders.update")}</button>
            </div>
            {status === "CANCELLED" && !locked && <p className="notice notice--warn small">{t("admin.orders.cancelWarn")}</p>}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default function Orders() {
  const { t, lang } = useI18n();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState(null);
  const { data, error, loading, reload } = useAdminQuery((pin) => getOrders(pin, { status }), [status]);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.orders || []).filter((o) => !q || [o.order_id, o.customer_name, o.customer_email, o.customer_phone, o.company, o.delivery_address].join(" ").toLowerCase().includes(q));
  }, [data, search]);
  const open = list.find((o) => o.order_id === openId) || data?.orders?.find((o) => o.order_id === openId);

  return (
    <div>
      <div className="admin-toolbar">
        <input className="input" type="search" placeholder={t("admin.orders.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t("admin.orders.status")}>
          <option value="">{t("admin.orders.allStatuses")}</option>
          {STATUSES.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
        {loading && <span className="spinner spinner--sm" />}
        <span className="muted small">{list.length}</span>
      </div>
      <AdminError error={error} onRetry={reload} />
      {!data && loading ? <Spinner /> : (
        <div className="table-wrap panel panel--flush">
          <table className="table table--hover">
            <thead><tr><th>ID</th><th>{t("admin.orders.date")}</th><th>{t("admin.orders.customer")}</th><th className="r">{t("admin.orders.items")}</th><th className="r">{t("admin.orders.total")}</th><th className="r">{t("admin.orders.profit")}</th><th>{t("admin.orders.status")}</th><th /></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.order_id} onClick={() => setOpenId(o.order_id)}>
                  <td className="mono">{o.order_id}</td>
                  <td>{formatDate(o.order_date, lang, true)}</td>
                  <td>{o.customer_name}<div className="muted small">{o.customer_email}</div></td>
                  <td className="r">{o.units}</td>
                  <td className="r">{formatMoney(o.total_amount)}</td>
                  <td className="r">{o.order_status === "CANCELLED" ? "—" : formatMoney(o.gross_profit)}</td>
                  <td><StatusPill status={o.order_status} /></td>
                  <td><button className="btn btn--ghost btn--sm" onClick={(e) => { e.stopPropagation(); setOpenId(o.order_id); }}>{t("admin.orders.view")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <OrderDetail order={open} onClose={() => setOpenId(null)} onChanged={reload} />}
    </div>
  );
}
