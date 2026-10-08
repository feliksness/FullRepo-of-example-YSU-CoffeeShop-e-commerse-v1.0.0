// Coffee Lab — admin area (demo PIN from the SETTINGS sheet)
// Built by FeliksKhangeldyan
import { useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { useI18n } from "../../context/LanguageContext.jsx";
import { useAdmin } from "../../context/AdminContext.jsx";
import { errorMessage } from "../../utils/errors.js";
import Overview from "./Overview.jsx";
import Orders from "./Orders.jsx";
import Products from "./Products.jsx";
import Inventory from "./Inventory.jsx";
import Purchases from "./Purchases.jsx";
import Expenses from "./Expenses.jsx";
import Reports from "./Reports.jsx";

function Login() {
  const { t } = useI18n();
  const { login } = useAdmin();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try { await login(pin.trim()); } catch (err) { setError(err); } finally { setBusy(false); }
  };
  return (
    <section className="container page admin-login">
      <form className="panel admin-login__card" onSubmit={submit}>
        <p className="eyebrow">Coffee Lab</p>
        <h1 className="display display--sm">{t("admin.login")}</h1>
        <div className="field">
          <label htmlFor="pin">{t("admin.pin")}</label>
          <input id="pin" type="password" inputMode="numeric" autoComplete="current-password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        </div>
        {error && <div className="notice notice--error">{errorMessage(error, t)}</div>}
        <button className="btn btn--block" disabled={busy || !pin}>{busy ? t("common.loading") : t("admin.signIn")}</button>
        <p className="muted small">{t("admin.pinHint")}</p>
      </form>
    </section>
  );
}

const TABS = [
  ["", "overview"], ["orders", "orders"], ["products", "products"], ["inventory", "inventory"],
  ["purchases", "purchases"], ["expenses", "expenses"], ["reports", "reports"]
];

export default function Admin() {
  const { t } = useI18n();
  const { isAdmin, logout } = useAdmin();
  if (!isAdmin) return <Login />;
  return (
    <section className="admin">
      <div className="admin__bar">
        <div className="container admin__bar-inner">
          <h1 className="admin__title">{t("admin.title")}</h1>
          <nav className="admin__tabs" aria-label={t("admin.title")}>
            {TABS.map(([path, key]) => (
              <NavLink key={key} to={`/admin${path ? "/" + path : ""}`} end={!path}>{t(`admin.tabs.${key}`)}</NavLink>
            ))}
          </nav>
          <button className="btn btn--ghost btn--sm" onClick={logout}>{t("admin.signOut")}</button>
        </div>
      </div>
      <div className="container admin__body">
        <Routes>
          <Route index element={<Overview />} />
          <Route path="orders" element={<Orders />} />
          <Route path="products" element={<Products />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="purchases" element={<Purchases />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="reports" element={<Reports />} />
        </Routes>
      </div>
    </section>
  );
}
