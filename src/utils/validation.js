// Coffee Lab — client-side validation (the backend validates again).
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validPhone(s) {
  const str = String(s || "").trim();
  return /^\+?[0-9\s\-()]{7,20}$/.test(str) && str.replace(/\D/g, "").length >= 8;
}

export function validateCheckout(form, location) {
  const e = {};
  const name = form.name.trim();
  if (name.length < 2 || name.length > 80) e.name = "validation.name";
  if (!EMAIL_RE.test(form.email.trim())) e.email = "validation.email";
  if (!validPhone(form.phone)) e.phone = "validation.phone";
  if (form.address.trim().length < 5) e.address = "validation.address";
  if (!location || !isFinite(location.lat) || !isFinite(location.lng)) e.location = "validation.location";
  return e;
}

/** Maps backend field names to form fields. */
export const BACKEND_FIELD_MAP = {
  customer_name: "name", customer_email: "email", customer_phone: "phone",
  delivery_address: "address", delivery_location: "location"
};
