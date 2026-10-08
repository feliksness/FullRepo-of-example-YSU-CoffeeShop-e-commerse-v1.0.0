/**
 * Coffee Lab — API client for the Google Apps Script web app.
 * Built by FeliksKhangeldyan
 *
 * Requests are sent as POST with Content-Type text/plain so the browser does not
 * issue a CORS preflight (Apps Script cannot answer OPTIONS). Apps Script replies
 * via a redirect to googleusercontent.com which allows cross-origin reads.
 */
import { CONFIG, API_TIMEOUT_MS } from "../config/config.js";

// Optional override for local testing only: VITE_APPS_SCRIPT_URL=... npm run dev
const API_URL = import.meta.env.VITE_APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL;

export class ApiError extends Error {
  constructor(code, message, details = null) {
    super(message || code);
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(action, payload = {}, { timeout = API_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
      redirect: "follow",
      signal: controller.signal
    });
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === "AbortError") throw new ApiError("TIMEOUT", "Request timed out");
    throw new ApiError("NETWORK_ERROR", "Network error");
  }
  clearTimeout(timer);
  if (!res.ok) throw new ApiError("BACKEND_UNAVAILABLE", `HTTP ${res.status}`);
  let body;
  try {
    body = await res.json();
  } catch {
    // Apps Script returns an HTML page when the deployment is missing or not public.
    throw new ApiError("BACKEND_UNAVAILABLE", "Invalid response from backend");
  }
  if (!body || typeof body !== "object" || !("success" in body)) throw new ApiError("BAD_RESPONSE", "Unexpected response");
  if (!body.success) {
    const e = body.error || {};
    throw new ApiError(e.code || "INTERNAL_ERROR", e.message || "Request failed", e.details || null);
  }
  return body.data;
}
