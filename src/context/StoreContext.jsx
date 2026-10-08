// Coffee Lab — catalog/settings loaded from Google Sheets via Apps Script.
// If the backend is unreachable, a bundled read-only catalog preview is shown (checkout disabled).
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProducts } from "../api/endpoints.js";
import { FALLBACK_SETTINGS } from "../config/config.js";
import fallbackCatalog from "../data/fallbackCatalog.json";

const StoreContext = createContext(null);
export const CATEGORY_KEYS = ["coffee-beans", "ground-coffee", "instant-coffee", "syrups-addons", "filters-consumables", "brewing-equipment", "accessories-storage"];

export function StoreProvider({ children }) {
  const [state, setState] = useState({ status: "loading", products: [], settings: FALLBACK_SETTINGS, error: null, loadedAt: 0 });

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, status: s.products.length ? s.status : "loading", error: null }));
    try {
      const data = await getProducts();
      setState({
        status: data.products.length ? "ready" : "empty",
        products: data.products,
        settings: { ...FALLBACK_SETTINGS, ...(data.settings || {}) },
        error: null,
        loadedAt: Date.now()
      });
      return data.products;
    } catch (err) {
      setState((s) => ({
        status: s.status === "ready" ? "ready" : "offline",
        products: s.status === "ready" ? s.products : fallbackCatalog,
        settings: s.settings,
        error: err,
        loadedAt: s.loadedAt
      }));
      return null;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const value = useMemo(() => {
    const byId = {};
    state.products.forEach((p) => { byId[p.product_id] = p; });
    return { ...state, byId, reload: load, offline: state.status === "offline" };
  }, [state, load]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext);
