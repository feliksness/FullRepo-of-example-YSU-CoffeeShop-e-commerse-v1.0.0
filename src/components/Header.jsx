// Coffee Lab — site header with glass navigation, HY | EN switch and cart count.
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { LANGUAGES } from "../i18n/index.js";

export function LangSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label="Language">
      {LANGUAGES.map((l, i) => (
        <span key={l.code}>
          {i > 0 && <span className="lang-switch__sep" aria-hidden="true">|</span>}
          <button type="button" className={lang === l.code ? "is-active" : ""} aria-pressed={lang === l.code} title={l.name} onClick={() => setLang(l.code)}>
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}

export function Logo() {
  return (
    <Link to="/" className="logo" aria-label="Coffee Lab">
      <span className="logo__mark" aria-hidden="true">
        <svg viewBox="0 0 32 32"><ellipse cx="16" cy="16" rx="8" ry="12" transform="rotate(30 16 16)" fill="currentColor" /><path d="M13 6c4 5 1 15 6 20" stroke="var(--cream)" strokeWidth="2" fill="none" strokeLinecap="round" transform="rotate(30 16 16)" /></svg>
      </span>
      <span className="logo__word">Coffee<b>Lab</b></span>
    </Link>
  );
}

export default function Header() {
  const { t } = useI18n();
  const { count } = useCart();
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(false);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!count) return;
    setBump(true);
    const id = setTimeout(() => setBump(false), 400);
    return () => clearTimeout(id);
  }, [count]);

  return (
    <header className="site-header">
      <div className="site-header__inner container">
        <Logo />
        <nav className={`main-nav ${open ? "is-open" : ""}`} aria-label="Main">
          <NavLink to="/" end>{t("nav.home")}</NavLink>
          <NavLink to="/shop">{t("nav.shop")}</NavLink>
          <NavLink to="/track">{t("nav.track")}</NavLink>
          <NavLink to="/admin" className="main-nav__admin">{t("nav.admin")}</NavLink>
        </nav>
        <div className="site-header__actions">
          <LangSwitch />
          <Link to="/cart" className={`cart-button ${bump ? "is-bumping" : ""}`} aria-label={`${t("nav.cart")} (${count})`}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" fill="none" stroke="currentColor" strokeWidth="1.8" /><path d="M9 7V6a3 3 0 0 1 6 0v1" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            <span className="cart-button__label">{t("nav.cart")}</span>
            {count > 0 && <span className="cart-button__count">{count}</span>}
          </Link>
          <button className="menu-toggle" type="button" aria-expanded={open} aria-label={open ? t("nav.close") : t("nav.menu")} onClick={() => setOpen((o) => !o)}>
            <span /><span />
          </button>
        </div>
      </div>
    </header>
  );
}
