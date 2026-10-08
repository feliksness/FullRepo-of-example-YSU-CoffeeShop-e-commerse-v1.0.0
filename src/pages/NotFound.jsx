import { Link } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { EmptyState } from "../components/States.jsx";

export default function NotFound() {
  const { t } = useI18n();
  return (
    <section className="container page">
      <EmptyState title="404" action={<Link className="btn" to="/shop">{t("cart.emptyCta")}</Link>} />
    </section>
  );
}
