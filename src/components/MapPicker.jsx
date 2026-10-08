// Coffee Lab — delivery location picker: Leaflet + OpenStreetMap tiles + Nominatim (all free).
// Click the map or drag the pin; optional browser geolocation and address search.
// Built by FeliksKhangeldyan
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useI18n } from "../context/LanguageContext.jsx";
import { DEFAULT_MAP_CENTER } from "../config/config.js";
import { reverseGeocode, searchAddress } from "../utils/geocode.js";

export const pinIcon = L.divIcon({
  className: "map-pin",
  html: '<span class="map-pin__body"><span class="map-pin__bean"></span></span>',
  iconSize: [36, 46],
  iconAnchor: [18, 44]
});

export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors · Search: Nominatim';
export const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [target, map]);
  return null;
}

export default function MapPicker({ value, onChange, onUseAddress, error }) {
  const { t, lang } = useI18n();
  const [flyTarget, setFlyTarget] = useState(null);
  const [found, setFound] = useState("");
  const [geoState, setGeoState] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const markerRef = useRef(null);
  const reqId = useRef(0);

  const pick = (loc, fly = false) => {
    const rounded = { lat: Math.round(loc.lat * 1e6) / 1e6, lng: Math.round(loc.lng * 1e6) / 1e6 };
    onChange(rounded);
    if (fly) setFlyTarget(rounded);
  };

  // Reverse geocode whenever the pin moves (debounced + throttled).
  useEffect(() => {
    if (!value) { setFound(""); return; }
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const addr = await reverseGeocode(value.lat, value.lng, lang);
        if (id === reqId.current) setFound(addr || "");
      } catch {
        if (id === reqId.current) setFound("");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [value, lang]);

  const markerHandlers = useMemo(() => ({
    dragend() {
      const m = markerRef.current;
      if (m) { const p = m.getLatLng(); pick({ lat: p.lat, lng: p.lng }); }
    }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () => {
    if (!navigator.geolocation) { setGeoState(t("checkout.geoUnavailable")); return; }
    setGeoState(t("checkout.locating"));
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGeoState(""); pick({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true); },
      (err) => setGeoState(err.code === 1 ? t("checkout.geoDenied") : t("checkout.geoUnavailable")),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const runSearch = async (e) => {
    if (e) e.preventDefault();
    if (query.trim().length < 3) return;
    setSearching(true);
    try {
      setResults(await searchAddress(query.trim(), lang));
    } catch {
      setResults([]);
      setGeoState(t("checkout.searchFailed"));
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className={`map-picker ${error ? "has-error" : ""}`}>
      <div className="map-picker__tools">
        {/* Not a <form>: this picker lives inside the checkout form, and forms cannot be nested. */}
        <div className="map-search" role="search">
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("checkout.searchPh")} aria-label={t("checkout.searchAddress")}
            onKeyDown={(e) => { if (e.key === "Enter") runSearch(e); }} />
          <button type="button" className="btn btn--ghost btn--sm" disabled={searching} onClick={() => runSearch()}>{searching ? t("checkout.searching") : t("checkout.searchAddress")}</button>
        </div>
        <button type="button" className="btn btn--ghost btn--sm" onClick={locate}>
          <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" /></svg>
          {t("checkout.useMyLocation")}
        </button>
      </div>
      {results && (
        <ul className="map-results">
          {results.length === 0 && <li className="muted">{t("checkout.noResults")}</li>}
          {results.map((r, i) => (
            <li key={i}>
              <button type="button" onClick={() => { pick(r, true); setResults(null); }}>{r.label}</button>
            </li>
          ))}
        </ul>
      )}
      <div className="map-picker__map">
        <MapContainer center={value ? [value.lat, value.lng] : DEFAULT_MAP_CENTER} zoom={value ? 16 : 13} scrollWheelZoom={true}>
          <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
          <ClickHandler onPick={(loc) => pick(loc)} />
          <FlyTo target={flyTarget} />
          {value && <Marker position={[value.lat, value.lng]} draggable icon={pinIcon} eventHandlers={markerHandlers} ref={markerRef} />}
        </MapContainer>
        {!value && <div className="map-picker__hint">{t("checkout.mapHint")}</div>}
      </div>
      <div className="map-picker__status">
        {value ? (
          <>
            <span className="mono">{t("checkout.selected")}: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}</span>
            {found && (
              <span className="map-picker__found">
                {found}
                {onUseAddress && <button type="button" className="link-btn" onClick={() => onUseAddress(found)}>{t("checkout.useAddress")}</button>}
              </span>
            )}
          </>
        ) : (
          <span className="muted">{t("checkout.noLocation")}</span>
        )}
        {geoState && <span className="muted">{geoState}</span>}
      </div>
    </div>
  );
}

/** Read-only map used on the success page and in the admin order detail. */
export function MiniMap({ lat, lng, height = 220 }) {
  if (!isFinite(lat) || !isFinite(lng)) return null;
  return (
    <div className="mini-map" style={{ height }}>
      <MapContainer center={[lat, lng]} zoom={16} scrollWheelZoom={false} dragging={true}>
        <TileLayer url={OSM_TILES} attribution={OSM_ATTRIBUTION} maxZoom={19} />
        <Marker position={[lat, lng]} icon={pinIcon} />
      </MapContainer>
    </div>
  );
}
