// Coffee Lab — cart ESTIMATE (mirrors calcOrderTotals_ in Apps Script).
// The backend recalculates everything from Google Sheets; these numbers are display-only.
export function estimateTotals(lines, settings) {
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.price, 0);
  const units = lines.reduce((s, l) => s + l.quantity, 0);
  let discount = 0;
  if (settings.discount_rate > 0 && settings.discount_threshold > 0 && subtotal >= settings.discount_threshold) {
    discount = Math.round((subtotal * settings.discount_rate) / 100);
  }
  const net = subtotal - discount;
  let delivery = settings.free_delivery_threshold > 0 && net >= settings.free_delivery_threshold ? 0 : settings.default_delivery_fee;
  if (units === 0) delivery = 0;
  return {
    units,
    subtotal,
    discount,
    delivery,
    total: net + delivery,
    toFreeDelivery: Math.max(0, settings.free_delivery_threshold - net),
    toDiscount: Math.max(0, settings.discount_threshold - subtotal)
  };
}
