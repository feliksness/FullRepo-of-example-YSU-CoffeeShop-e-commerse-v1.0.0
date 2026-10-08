// Coffee Lab — home page
import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useI18n } from "../context/LanguageContext.jsx";
import { CATEGORY_KEYS, useStore } from "../context/StoreContext.jsx";
import ProductCard from "../components/ProductCard.jsx";
import ProductArt from "../components/ProductArt.jsx";
import { SkeletonGrid, Notice } from "../components/States.jsx";
import { formatMoney } from "../utils/format.js";

const FEATURED = ["CB-ETH-YIR-250", "CB-KEN-AA-250", "CB-PAN-GEI-100", "CB-COL-SUP-500"];
const BEST = ["CB-HOU-ESP-1KG", "GR-TRK-200", "SY-CAR-700", "EQ-MOK-6", "CB-BRA-CER-500", "AC-MUG-TRV", "IN-PRM-100", "EQ-FRP-1000"];

export default function Home() {
  const { t } = useI18n();
  const { products, status, settings, offline } = useStore();
  const bySku = useMemo(() => Object.fromEntries(products.map((p) => [p.sku, p])), [products]);
  const pickList = (skus) => skus.map((s) => bySku[s]).filter(Boolean);
  const featured = pickList(FEATURED);
  const best = pickList(BEST);
  const origins = new Set(products.filter((p) => p.category === "coffee-beans").flatMap((p) => (p.origin || "").split("·").map((s) => s.trim()))).size;
  const heroProducts = pickList(["CB-PRM-ESP-1KG", "EQ-MOK-6", "SY-VAN-700"]);

  return (
    <div className="home">
      <section className="hero container">
        <div className="hero__copy">
          <p className="eyebrow">{t("home.eyebrow")}</p>
          <h1 className="display">{t("home.title")}</h1>
          <p className="lead">{t("home.subtitle")}</p>
          <div className="hero__ctas">
            <Link to="/shop" className="btn btn--lg">{t("home.ctaShop")} →</Link>
            <Link to="/shop?category=coffee-beans" className="btn btn--ghost btn--lg">{t("home.ctaBeans")}</Link>
          </div>
          <dl className="hero__stats">
            <div><dt>{products.length || 75}</dt><dd>{t("home.statProducts")}</dd></div>
            <div><dt>{origins || 12}</dt><dd>{t("home.statOrigins")}</dd></div>
            <div><dt>{formatMoney(settings.free_delivery_threshold)}</dt><dd>{t("home.statDelivery")}</dd></div>
          </dl>
        </div>
        <div className="hero__visual" aria-hidden="true">
          <div className="hero__card hero__card--a">{heroProducts[0] && <ProductArt product={heroProducts[0]} />}</div>
          <div className="hero__card hero__card--b">{heroProducts[1] && <ProductArt product={heroProducts[1]} />}</div>
          <div className="hero__card hero__card--c">{heroProducts[2] && <ProductArt product={heroProducts[2]} />}</div>
          <div className="hero__badge glass">
            <span className="mono">ROAST · 2026</span>
            <strong>Yerevan</strong>
          </div>
        </div>
      </section>

      {offline && <div className="container"><Notice tone="warn">{t("errors.offlineCatalog")}</Notice></div>}

      <section className="container section">
        <div className="section__head"><h2>{t("home.categoriesTitle")}</h2><Link to="/shop" className="link-arrow">{t("common.viewAll")} →</Link></div>
        <div className="category-grid">
          {CATEGORY_KEYS.map((k, i) => {
            const sample = products.find((p) => p.category === k);
            const count = products.filter((p) => p.category === k).length;
            return (
              <Link key={k} to={`/shop?category=${k}`} className={`category-tile ${i === 0 ? "category-tile--big" : ""}`}>
                <div className="category-tile__art">{sample && <ProductArt product={sample} />}</div>
                <div className="category-tile__text">
                  <span className="mono">{String(count).padStart(2, "0")}</span>
                  <h3>{t(`categories.${k}`)}</h3>
                  <p>{t(`categoryBlurb.${k}`)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="container section">
        <div className="section__head"><div><h2>{t("home.featuredTitle")}</h2><p className="muted">{t("home.featuredSub")}</p></div></div>
        {status === "loading" ? <SkeletonGrid n={4} /> : <div className="product-grid">{featured.map((p) => <ProductCard key={p.product_id} product={p} />)}</div>}
      </section>

      <section className="section band">
        <div className="container">
          <h2>{t("home.benefitsTitle")}</h2>
          <div className="benefits">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="benefit">
                <span className="benefit__num mono">0{n}</span>
                <h3>{t(`home.b${n}t`)}</h3>
                <p>{t(`home.b${n}d`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="section__head"><div><h2>{t("home.bestTitle")}</h2><p className="muted">{t("home.bestSub")}</p></div><Link to="/shop" className="link-arrow">{t("common.viewAll")} →</Link></div>
        {status === "loading" ? <SkeletonGrid n={8} /> : <div className="product-grid">{best.map((p) => <ProductCard key={p.product_id} product={p} />)}</div>}
      </section>

      <section className="container section">
        <div className="delivery-card">
          <div>
            <h2>{t("home.deliveryTitle")}</h2>
            <p>{t("home.deliveryText", {
              fee: formatMoney(settings.default_delivery_fee), threshold: formatMoney(settings.free_delivery_threshold),
              dthreshold: formatMoney(settings.discount_threshold), rate: settings.discount_rate
            })}</p>
          </div>
          <div className="delivery-card__cta">
            <h3>{t("home.ctaTitle")}</h3>
            <p>{t("home.ctaText")}</p>
            <Link to="/shop" className="btn btn--cream">{t("home.ctaShop")} →</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
