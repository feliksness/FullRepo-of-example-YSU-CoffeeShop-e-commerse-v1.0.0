// Coffee Lab — loading / empty / error states
import { useI18n } from "../context/LanguageContext.jsx";
import { errorMessage } from "../utils/errors.js";

export function Spinner({ label }) {
  const { t } = useI18n();
  return (
    <div className="state state--loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label || t("common.loading")}</span>
    </div>
  );
}

export function SkeletonGrid({ n = 8 }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => <div key={i} className="skeleton-card"><div /><span /><span /></div>)}
    </div>
  );
}

export function EmptyState({ title, action }) {
  return (
    <div className="state state--empty">
      <svg viewBox="0 0 64 64" aria-hidden="true"><path d="M14 22h36l-3 30a4 4 0 0 1-4 4H21a4 4 0 0 1-4-4Z" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M50 28h4a6 6 0 0 1 0 12h-5" fill="none" stroke="currentColor" strokeWidth="3" /><path d="M24 8c-3 4 3 6 0 10M33 8c-3 4 3 6 0 10" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" /></svg>
      <p>{title}</p>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const { t } = useI18n();
  return (
    <div className="state state--error" role="alert">
      <p>{errorMessage(error, t)}</p>
      {onRetry && <button className="btn btn--ghost" onClick={onRetry}>{t("common.retry")}</button>}
    </div>
  );
}

export function Notice({ children, tone = "info" }) {
  return <div className={`notice notice--${tone}`}>{children}</div>;
}
