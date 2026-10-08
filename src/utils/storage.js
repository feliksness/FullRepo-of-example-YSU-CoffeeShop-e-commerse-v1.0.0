// Coffee Lab — safe LocalStorage wrapper (cart, language, checkout draft, last order).
// LocalStorage is only a convenience cache; Google Sheets is the real database.
const PREFIX = "coffeelab:";

export const KEYS = { cart: "cart", lang: "lang", draft: "checkoutDraft", lastOrder: "lastOrder" };

export function load(key, fallback) {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function save(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage full or blocked (private mode) — app keeps working in memory */
  }
}

export function remove(key) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
