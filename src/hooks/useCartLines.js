// Coffee Lab — joins the LocalStorage cart with the live catalog (prices/stock from the backend).
import { useMemo } from "react";
import { useCart } from "../context/CartContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { estimateTotals } from "../utils/pricing.js";

export default function useCartLines() {
  const { items } = useCart();
  const { byId, settings, status } = useStore();
  return useMemo(() => {
    const lines = items.map((i) => {
      const p = byId[i.product_id];
      const available = p ? Math.max(0, p.stock_qty) : 0;
      return {
        ...i,
        product: p || null,
        price: p ? p.sale_price : 0,
        available,
        problem: status === "loading" ? null : !p ? "unavailable" : available <= 0 ? "unavailable" : i.quantity > available ? "reduced" : null
      };
    });
    const valid = lines.filter((l) => l.product && !l.problem);
    const totals = estimateTotals(valid.map((l) => ({ quantity: l.quantity, price: l.price })), settings);
    return { lines, totals, settings, hasProblems: lines.some((l) => l.problem) };
  }, [items, byId, settings, status]);
}
