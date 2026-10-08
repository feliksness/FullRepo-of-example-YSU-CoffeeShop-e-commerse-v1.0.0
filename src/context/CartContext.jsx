// Coffee Lab — cart persisted in LocalStorage (survives refresh & browser restart).
// Only product_id + quantity are trusted locally; prices always come from the live catalog/backend.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { KEYS, load, save } from "../utils/storage.js";

const CartContext = createContext(null);
const MAX_QTY = 99;

function sanitize(items) {
  if (!Array.isArray(items)) return [];
  return items
    .filter((i) => i && typeof i.product_id === "string" && Number.isInteger(i.quantity) && i.quantity > 0)
    .map((i) => ({ product_id: i.product_id, quantity: Math.min(MAX_QTY, i.quantity), added_at: i.added_at || Date.now() }));
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => sanitize(load(KEYS.cart, [])));

  useEffect(() => { save(KEYS.cart, items); }, [items]);

  // Keep tabs in sync.
  useEffect(() => {
    const onStorage = (e) => { if (e.key === "coffeelab:" + KEYS.cart) setItems(sanitize(load(KEYS.cart, []))); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  /** Adds qty; returns the quantity actually added (respects known stock). */
  const add = useCallback((product, qty = 1) => {
    let added = 0;
    setItems((prev) => {
      const limit = Math.min(MAX_QTY, product.stock_qty ?? MAX_QTY);
      const existing = prev.find((i) => i.product_id === product.product_id);
      const current = existing ? existing.quantity : 0;
      const next = Math.min(limit, current + qty);
      added = next - current;
      if (added <= 0) return prev;
      if (existing) return prev.map((i) => (i.product_id === product.product_id ? { ...i, quantity: next } : i));
      return [...prev, { product_id: product.product_id, quantity: next, added_at: Date.now() }];
    });
    return added;
  }, []);

  const setQty = useCallback((product_id, quantity) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.product_id !== product_id)
        : prev.map((i) => (i.product_id === product_id ? { ...i, quantity: Math.min(MAX_QTY, quantity) } : i))
    );
  }, []);

  const remove = useCallback((product_id) => setItems((prev) => prev.filter((i) => i.product_id !== product_id)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(() => ({
    items, add, setQty, remove, clear,
    count: items.reduce((s, i) => s + i.quantity, 0),
    qtyOf: (id) => items.find((i) => i.product_id === id)?.quantity || 0
  }), [items, add, setQty, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => useContext(CartContext);
