// Coffee Lab — checkout: customer details + OSM delivery pin + demo cash-on-delivery.
// The backend re-reads prices/stock from Google Sheets; only product_id + quantity are sent.
// Built by FeliksKhangeldyan
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useI18n } from "../context/LanguageContext.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useStore } from "../context/StoreContext.jsx";
import { useToast } from "../context/ToastContext.jsx";
import useCartLines from "../hooks/useCartLines.js";
import MapPicker from "../components/MapPicker.jsx";
import CartSummary from "../components/CartSummary.jsx";
import { Notice } from "../components/States.jsx";
import { createOrder } from "../api/endpoints.js";
import { KEYS, load, save } from "../utils/storage.js";
import { BACKEND_FIELD_MAP, validateCheckout } from "../utils/validation.js";
import { errorMessage } from "../utils/errors.js";
import { formatMoney, productName } from "../utils/format.js";

const EMPTY = { name: "", email: "", phone: "", company: "", address: "", notes: "" };
const newRequestId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

function Field({ id, label, error, optional, t, children }) {
  return (
    <div className={`field ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>{label}{optional && <span className="muted"> ({t("common.optional")})</span>}</label>
      {children}
      {error && <span className="field__error" id={`${id}-err`}>{t(error)}</span>}
    </div>
  );
}

export default function Checkout() {
  const { t, lang } = useI18n();
  const { clear, items } = useCart();
  const { offline, reload } = useStore();
  const { notify } = useToast();
  const navigate = useNavigate();
  const { lines, totals, settings, hasProblems } = useCartLines();
  const draft = useMemo(() => load(KEYS.draft, {}), []);
  const [form, setForm] = useState({ ...EMPTY, ...(draft.form || {}) });
  const [location, setLocation] = useState(draft.location || null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const requestId = useRef(newRequestId());
  const cartSignature = JSON.stringify(items.map((i) => [i.product_id, i.quantity]));

  useEffect(() => { save(KEYS.draft, { form, location }); }, [form, location]);
  // A changed cart is a new order attempt.
  useEffect(() => { requestId.current = newRequestId(); }, [cartSignature]);

  if (!items.length && !submitting) return <Navigate to="/cart" replace />;

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: undefined }));
  };

  const onLocation = (loc) => {
    setLocation(loc);
    if (errors.location) setErrors((er) => ({ ...er, location: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return; // duplicate-submission guard
    const v = validateCheckout(form, location);
    setErrors(v);
    setServerError(null);
    if (Object.keys(v).length) {
      const first = document.querySelector(".has-error");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    try {
      const order = await createOrder({
        client_request_id: requestId.current,
        customer: {
          customer_name: form.name.trim(), customer_email: form.email.trim(), customer_phone: form.phone.trim(),
          company: form.company.trim(), delivery_address: form.address.trim(), delivery_notes: form.notes.trim(),
          delivery_latitude: location.lat, delivery_longitude: location.lng
        },
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        lang
      });
      save(KEYS.lastOrder, order);
      save(KEYS.draft, { form: { ...form, address: "", notes: "" }, location: null });
      clear();
      reload(true);
      navigate("/order/success", { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err.code === "VALIDATION_ERROR" || err.code === "MISSING_LOCATION") {
        const fe = {};
        (err.details?.fields || ["delivery_location"]).forEach((f) => {
          const k = BACKEND_FIELD_MAP[f];
          if (k) fe[k] = `validation.${k === "name" ? "name" : k}`;
        });
        setErrors(fe);
      }
      if (err.code === "OUT_OF_STOCK" || err.code === "PRODUCT_UNAVAILABLE") {
        await reload(true);
        notify(errorMessage(err, t), "warn", 6000);
        navigate("/cart");
        return;
      }
      setServerError(err);
    }
  };

  const blocked = offline || hasProblems || totals.units === 0;

  return (
    <section className="container page checkout">
      <header className="page-head">
        <nav className="breadcrumbs"><Link to="/cart">← {t("nav.cart")}</Link></nav>
        <h1 className="display display--sm">{t("checkout.title")}</h1>
        <p className="muted">{t("checkout.draftSaved")}</p>
      </header>
      {offline && <Notice tone="warn">{t("errors.offlineCheckout")}</Notice>}
      <form className="checkout__grid" onSubmit={submit} noValidate>
        <div className="checkout__main">
          <fieldset className="panel">
            <legend><span className="step-num">1</span>{t("checkout.contact")}</legend>
            <div className="form-grid">
              <Field id="name" label={t("checkout.name")} error={errors.name} t={t}>
                <input id="name" autoComplete="name" value={form.name} onChange={set("name")} maxLength={80} aria-invalid={!!errors.name} />
              </Field>
              <Field id="email" label={t("checkout.email")} error={errors.email} t={t}>
                <input id="email" type="email" autoComplete="email" value={form.email} onChange={set("email")} maxLength={120} aria-invalid={!!errors.email} />
              </Field>
              <Field id="phone" label={t("checkout.phone")} error={errors.phone} t={t}>
                <input id="phone" type="tel" autoComplete="tel" placeholder={t("checkout.phonePh")} value={form.phone} onChange={set("phone")} maxLength={25} aria-invalid={!!errors.phone} />
              </Field>
              <Field id="company" label={t("checkout.company")} optional t={t}>
                <input id="company" autoComplete="organization" value={form.company} onChange={set("company")} maxLength={100} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="panel">
            <legend><span className="step-num">2</span>{t("checkout.delivery")}</legend>
            <MapPicker value={location} onChange={onLocation} error={errors.location}
              onUseAddress={(addr) => { setForm((f) => ({ ...f, address: addr })); setErrors((er) => ({ ...er, address: undefined })); }} />
            {errors.location && <span className="field__error">{t(errors.location)}</span>}
            <div className="form-grid">
              <Field id="address" label={t("checkout.address")} error={errors.address} t={t}>
                <input id="address" autoComplete="street-address" value={form.address} onChange={set("address")} maxLength={250} aria-invalid={!!errors.address} />
              </Field>
              <Field id="notes" label={t("checkout.notes")} optional t={t}>
                <input id="notes" placeholder={t("checkout.notesPh")} value={form.notes} onChange={set("notes")} maxLength={500} />
              </Field>
            </div>
          </fieldset>

          <fieldset className="panel">
            <legend><span className="step-num">3</span>{t("checkout.payment")}</legend>
            <label className="pay-option is-selected">
              <input type="radio" checked readOnly name="payment" />
              <div>
                <strong>{t("checkout.cod")}</strong>
                <p className="muted">{t("checkout.codText")}</p>
              </div>
              <span className="demo-pill">{t("common.demoBadge")}</span>
            </label>
          </fieldset>
        </div>

        <CartSummary totals={totals} settings={settings} title={t("checkout.summary")}>
          <ul className="summary__lines">
            {lines.map((l) => (
              <li key={l.product_id}>
                <span>{l.product ? productName(l.product, lang) : l.product_id} <span className="muted">× {l.quantity}</span></span>
                <span>{formatMoney(l.price * l.quantity)}</span>
              </li>
            ))}
          </ul>
          {serverError && <Notice tone="error">{errorMessage(serverError, t)}</Notice>}
          <button type="submit" className="btn btn--lg btn--block" disabled={submitting || blocked} aria-busy={submitting}>
            {submitting ? <><span className="spinner spinner--sm" aria-hidden="true" /> {t("checkout.placing")}</> : `${t("checkout.place")} · ${formatMoney(totals.total)}`}
          </button>
          <p className="summary__note">{t("checkout.agree")}</p>
        </CartSummary>
      </form>
    </section>
  );
}
