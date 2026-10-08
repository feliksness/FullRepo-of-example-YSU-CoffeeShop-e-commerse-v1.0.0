// Coffee Lab — totals box (estimate; authoritative totals come from Apps Script)
import { useI18n } from "../context/LanguageContext.jsx";
import { formatMoney } from "../utils/format.js";

export default function CartSummary({ totals, settings, children, title }) {
  const { t } = useI18n();
  return (
    <aside className="summary glass">
      {title && <h3>{title}</h3>}
      <dl>
        <div><dt>{t("cart.subtotal")}</dt><dd>{formatMoney(totals.subtotal)}</dd></div>
        {totals.discount > 0 && <div className="summary__discount"><dt>{t("cart.discount", { rate: settings.discount_rate })}</dt><dd>{formatMoney(-totals.discount)}</dd></div>}
        <div><dt>{t("cart.delivery")}</dt><dd>{totals.delivery === 0 && totals.units > 0 ? t("cart.free") : formatMoney(totals.delivery)}</dd></div>
        <div className="summary__total"><dt>{t("cart.total")}</dt><dd>{formatMoney(totals.total)}</dd></div>
      </dl>
      {totals.units > 0 && totals.toFreeDelivery > 0 && <p className="summary__hint">{t("cart.freeHint", { amount: formatMoney(totals.toFreeDelivery) })}</p>}
      {totals.units > 0 && totals.toDiscount > 0 && totals.toFreeDelivery === 0 && <p className="summary__hint">{t("cart.discountHint", { amount: formatMoney(totals.toDiscount), rate: settings.discount_rate })}</p>}
      {children}
      <p className="summary__note">{t("cart.estimate")}</p>
    </aside>
  );
}
