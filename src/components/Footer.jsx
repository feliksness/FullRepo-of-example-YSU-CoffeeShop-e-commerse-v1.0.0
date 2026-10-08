// Coffee Lab — footer with developer credit and academic disclaimer.
import { Link } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { CATEGORY_KEYS } from "../context/StoreContext.jsx";
import { Logo } from "./Header.jsx";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="site-footer">
      <div className="container site-footer__grid">
        <div>
          <Logo />
          <p className="site-footer__tagline">{t("footer.tagline")}</p>
          <p className="demo-pill">{t("common.demoBadge")}</p>
        </div>
        <div>
          <h4>{t("footer.shop")}</h4>
          <ul>
            {CATEGORY_KEYS.map((k) => (
              <li key={k}><Link to={`/shop?category=${k}`}>{t(`categories.${k}`)}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <h4>{t("footer.help")}</h4>
          <ul>
            <li><Link to="/track">{t("nav.track")}</Link></li>
            <li><Link to="/cart">{t("nav.cart")}</Link></li>
            <li>{t("footer.delivery")}</li>
            <li>{t("footer.payment")}</li>
          </ul>
        </div>
      </div>
      <div className="container site-footer__bottom">
        <span>{t("footer.rights")}</span>
        <span>{t("footer.disclaimer")}</span>
        <span>{t("footer.map")}</span>
      </div>
    </footer>
  );
}
