import { useI18n } from "../context/LanguageContext.jsx";

export default function StockBadge({ product }) {
  const { t } = useI18n();
  const status = product.stock_status || (product.stock_qty <= 0 ? "out_of_stock" : "in_stock");
  return <span className={`stock-badge stock-badge--${status}`}>{t(`stock.${status}`, { n: product.stock_qty })}</span>;
}
