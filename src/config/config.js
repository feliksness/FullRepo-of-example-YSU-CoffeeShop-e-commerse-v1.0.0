/**
 * Coffee Lab — central configuration
 * Built by FeliksKhangeldyan
 * Change APPS_SCRIPT_URL here if you redeploy the Apps Script web app.
 */
export const CONFIG = {
  APPS_SCRIPT_URL:
    "https://script.google.com/macros/s/AKfycbyjoTYMguqkRaMJKlWN1MPAt1s3UHUgmuCGx8Hp4sSjkUfIfGanMPWKWVOWoDrehhBo/exec",
  STORE_NAME: "Coffee Lab",
  CURRENCY: "AMD",
  DEFAULT_LANGUAGE: "hy"
};

/** Non-authoritative defaults used only for cart estimates before settings load. */
export const FALLBACK_SETTINGS = {
  default_delivery_fee: 1500,
  free_delivery_threshold: 30000,
  discount_threshold: 60000,
  discount_rate: 5,
  currency: "AMD",
  demo_mode: true
};

export const DEFAULT_MAP_CENTER = [40.1792, 44.4991]; // Yerevan
export const API_TIMEOUT_MS = 25000;
export const DEVELOPER = "FeliksKhangeldyan";
