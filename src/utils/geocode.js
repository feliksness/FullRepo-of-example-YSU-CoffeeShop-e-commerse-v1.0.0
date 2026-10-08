// Coffee Lab — free OpenStreetMap Nominatim geocoding (max 1 request/second per usage policy).
let last = 0;
async function throttle() {
  const wait = Math.max(0, last + 1100 - Date.now());
  if (wait) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
}

export async function reverseGeocode(lat, lng, lang) {
  await throttle();
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}&accept-language=${lang === "hy" ? "hy,en" : "en"}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("reverse failed");
  const data = await res.json();
  if (!data || data.error) return null;
  const a = data.address || {};
  const street = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(" ");
  const short = [street, a.suburb || a.neighbourhood || a.city_district, a.city || a.town || a.village].filter(Boolean).join(", ");
  return short || data.display_name || null;
}

export async function searchAddress(q, lang) {
  await throttle();
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=am&q=${encodeURIComponent(q)}&accept-language=${lang === "hy" ? "hy,en" : "en"}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("search failed");
  const data = await res.json();
  return (data || []).map((r) => ({ label: r.display_name, lat: Number(r.lat), lng: Number(r.lon) }));
}
