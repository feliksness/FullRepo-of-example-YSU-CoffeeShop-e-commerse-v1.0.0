/**
 * ============================================================================
 *  COFFEE LAB — Google Apps Script backend (single-file build)
 *  Academic e-commerce project · Built by FeliksKhangeldyan · 2026
 * ============================================================================
 *
 *  Architecture:
 *    GitHub Pages (React) → this Web App (doGet/doPost) → Google Sheets → Drive PDFs
 *
 *  Quick start:
 *    1. Create a Google Sheet → Extensions → Apps Script → paste this file as Code.gs
 *    2. Run setupDatabase() once (authorize when asked)
 *    3. Deploy → New deployment → Web app → Execute as: Me · Who has access: Anyone
 *    4. Put the /exec URL into src/config/config.js of the frontend
 *
 *  Sections in this file:
 *    1. Core helpers & errors          7. Finance engine
 *    2. Database layer (Sheets)        8. Reports (daily / monthly)
 *    3. Validation                     9. PDF reports (Drive)
 *    4. Products                       10. Expenses
 *    5. Orders                         11. API router (doGet / doPost)
 *    6. Inventory & purchases          12. Setup, seed data & menu
 *
 *  All authoritative money / stock math happens here. The frontend is only
 *  a presentation layer and is never trusted for prices, costs or totals.
 * ============================================================================
 */

/* ==========================================================================
 * 1. CORE HELPERS & ERRORS
 * ========================================================================== */

var APP = {
  NAME: 'Coffee Lab',
  DEVELOPER: 'FeliksKhangeldyan',
  VERSION: '1.0.0',
  TIMEZONE: 'Asia/Yerevan',
  CURRENCY: 'AMD',
  SS_PROP: 'COFFEE_LAB_SPREADSHEET_ID'
};

/** Creates an error the API layer can safely show to clients. */
function apiError_(code, message, details) {
  var e = new Error(message || code);
  e.code = code;
  e.isApi = true;
  e.details = details || null;
  return e;
}

/** Safe number parsing (handles '', null, '1,200', Date etc.). */
function num_(v, fallback) {
  if (v === null || v === undefined || v === '') return fallback === undefined ? 0 : fallback;
  if (typeof v === 'number') return isFinite(v) ? v : (fallback || 0);
  var n = Number(String(v).replace(/[\s,֏]/g, ''));
  return isFinite(n) ? n : (fallback === undefined ? 0 : fallback);
}

function round2_(n) { return Math.round((num_(n) + Number.EPSILON) * 100) / 100; }
function roundInt_(n) { return Math.round(num_(n)); }
function safeDiv_(a, b) { return num_(b) === 0 ? 0 : num_(a) / num_(b); }
function pct_(part, whole) { return round2_(safeDiv_(part, whole) * 100); }
function pad_(n, len) { var s = String(n); while (s.length < len) s = '0' + s; return s; }

function bool_(v) {
  if (typeof v === 'boolean') return v;
  var s = String(v).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'y';
}

function tz_() {
  try {
    var ss = getSs_();
    return ss.getSpreadsheetTimeZone() || APP.TIMEZONE;
  } catch (e) {
    return APP.TIMEZONE;
  }
}

/** Parses Date objects, ISO strings and yyyy-MM-dd strings into a Date. */
function toDate_(v) {
  if (v instanceof Date) return v;
  if (v === null || v === undefined || v === '') return null;
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function dateKey_(v) {
  var d = toDate_(v);
  return d ? Utilities.formatDate(d, tz_(), 'yyyy-MM-dd') : '';
}

function monthKey_(v) {
  var d = toDate_(v);
  return d ? Utilities.formatDate(d, tz_(), 'yyyy-MM') : '';
}

function isoString_(v) {
  var d = toDate_(v);
  return d ? Utilities.formatDate(d, tz_(), "yyyy-MM-dd'T'HH:mm:ssXXX") : '';
}

/** Neutralises spreadsheet formula injection and trims/limits user text. */
function cleanText_(v, maxLen) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (maxLen && s.length > maxLen) s = s.substring(0, maxLen);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

/** Removes a leading apostrophe that may have been added by cleanText_. */
function plain_(v) {
  var s = v === null || v === undefined ? '' : String(v);
  return s.charAt(0) === "'" ? s.substring(1) : s;
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) throw apiError_('BUSY', 'The store is busy, please retry in a few seconds.');
  try {
    return fn();
  } finally {
    try { SpreadsheetApp.flush(); } catch (e) { /* ignore */ }
    lock.releaseLock();
  }
}

/* ==========================================================================
 * 2. DATABASE LAYER — Google Sheets as tables
 * ========================================================================== */

var SCHEMA = {
  PRODUCTS: ['product_id', 'sku', 'name_hy', 'name_en', 'category', 'description_hy', 'description_en',
    'origin', 'roast_level', 'grind_type', 'weight_g', 'unit', 'sale_price', 'unit_cost', 'stock_qty',
    'reorder_level', 'supplier', 'image_url', 'active', 'created_at', 'updated_at'],
  ORDERS: ['order_id', 'order_date', 'customer_name', 'customer_email', 'customer_phone', 'company',
    'delivery_address', 'delivery_latitude', 'delivery_longitude', 'delivery_notes', 'subtotal', 'discount',
    'delivery_fee', 'total_amount', 'currency', 'total_cogs', 'gross_profit', 'gross_margin_percent',
    'payment_method', 'payment_status', 'order_status', 'created_at', 'updated_at'],
  ORDER_ITEMS: ['order_item_id', 'order_id', 'product_id', 'sku', 'product_name', 'quantity',
    'unit_sale_price', 'unit_cost', 'line_revenue', 'line_cogs', 'line_profit', 'created_at'],
  PURCHASES: ['purchase_id', 'purchase_date', 'supplier', 'product_id', 'sku', 'quantity', 'unit_cost',
    'total_cost', 'currency', 'invoice_reference', 'notes', 'created_at'],
  INVENTORY_LOG: ['movement_id', 'date', 'product_id', 'sku', 'movement_type', 'quantity_change',
    'stock_before', 'stock_after', 'unit_cost', 'reference_id', 'notes', 'created_at'],
  EXPENSES: ['expense_id', 'expense_date', 'category', 'description', 'amount', 'currency', 'notes', 'created_at'],
  REPORT_DAILY: ['date', 'orders', 'units_sold', 'revenue', 'discounts', 'delivery_income', 'cogs',
    'gross_profit', 'gross_margin', 'operating_expenses', 'net_profit', 'average_order_value'],
  REPORT_MONTHLY: ['month', 'orders', 'units_sold', 'revenue', 'discounts', 'delivery_income', 'cogs',
    'gross_profit', 'gross_margin', 'operating_expenses', 'net_profit', 'average_order_value'],
  SETTINGS: ['store_name', 'currency', 'default_delivery_fee', 'free_delivery_threshold', 'tax_rate',
    'demo_mode', 'admin_pin', 'report_folder_id', 'discount_threshold', 'discount_rate'],
  AUDIT_LOG: ['timestamp', 'action', 'entity_type', 'entity_id', 'status', 'message', 'source']
};

var SHEET_ORDER = ['PRODUCTS', 'ORDERS', 'ORDER_ITEMS', 'PURCHASES', 'INVENTORY_LOG', 'EXPENSES',
  'REPORT_DAILY', 'REPORT_MONTHLY', 'SETTINGS', 'AUDIT_LOG'];

var DEFAULT_SETTINGS = {
  store_name: 'Coffee Lab',
  currency: 'AMD',
  default_delivery_fee: 1500,
  free_delivery_threshold: 30000,
  tax_rate: 0,
  demo_mode: true,
  admin_pin: '2026',
  report_folder_id: '',
  discount_threshold: 60000,
  discount_rate: 5
};

/** Per-execution cache of table reads (cleared after every write). */
var TABLE_CACHE_ = {};

function getSs_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(APP.SS_PROP);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* fall through */ }
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) {
    props.setProperty(APP.SS_PROP, active.getId());
    return active;
  }
  throw apiError_('NOT_CONFIGURED', 'Database is not set up. Run setupDatabase() first.');
}

function getSheet_(name) {
  var ss = getSs_();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, SCHEMA[name].length).setValues([SCHEMA[name]]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function invalidate_(name) {
  if (name) delete TABLE_CACHE_[name]; else TABLE_CACHE_ = {};
}

/** Reads a sheet into an array of plain objects keyed by the schema headers. */
function readTable_(name) {
  if (TABLE_CACHE_[name]) return TABLE_CACHE_[name];
  var sh = getSheet_(name);
  var headers = SCHEMA[name];
  var last = sh.getLastRow();
  var rows = [];
  if (last >= 2) {
    var values = sh.getRange(2, 1, last - 1, headers.length).getValues();
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      if (r.join('') === '') continue;
      var obj = { _row: i + 2 };
      for (var c = 0; c < headers.length; c++) obj[headers[c]] = r[c];
      rows.push(obj);
    }
  }
  TABLE_CACHE_[name] = rows;
  return rows;
}

function toRow_(name, obj) {
  return SCHEMA[name].map(function (h) {
    var v = obj[h];
    return v === undefined || v === null ? '' : v;
  });
}

/** Appends many objects in one setValues call. */
function appendRows_(name, objects) {
  if (!objects || !objects.length) return;
  var sh = getSheet_(name);
  var rows = objects.map(function (o) { return toRow_(name, o); });
  sh.getRange(sh.getLastRow() + 1, 1, rows.length, SCHEMA[name].length).setValues(rows);
  invalidate_(name);
}

/** Overwrites one existing row (obj must carry _row). */
function writeRow_(name, obj) {
  if (!obj._row) throw apiError_('INTERNAL_ERROR', 'Row reference missing');
  getSheet_(name).getRange(obj._row, 1, 1, SCHEMA[name].length).setValues([toRow_(name, obj)]);
  invalidate_(name);
}

/** Replaces all data rows of a sheet (used for report sheets). */
function replaceTable_(name, objects) {
  var sh = getSheet_(name);
  var width = SCHEMA[name].length;
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, width).clearContent();
  if (objects.length) {
    sh.getRange(2, 1, objects.length, width).setValues(objects.map(function (o) { return toRow_(name, o); }));
  }
  invalidate_(name);
}

function getSettings_() {
  var sh = getSheet_('SETTINGS');
  var s = {};
  for (var k in DEFAULT_SETTINGS) s[k] = DEFAULT_SETTINGS[k];
  if (sh.getLastRow() >= 2) {
    var vals = sh.getRange(2, 1, 1, SCHEMA.SETTINGS.length).getValues()[0];
    SCHEMA.SETTINGS.forEach(function (h, i) { if (vals[i] !== '' && vals[i] !== null) s[h] = vals[i]; });
  }
  ['default_delivery_fee', 'free_delivery_threshold', 'tax_rate', 'discount_threshold', 'discount_rate']
    .forEach(function (k) { s[k] = num_(s[k]); });
  s.demo_mode = bool_(s.demo_mode);
  s.admin_pin = String(s.admin_pin).trim();
  s.report_folder_id = String(s.report_folder_id || '').trim();
  return s;
}

function setSetting_(key, value) {
  var sh = getSheet_('SETTINGS');
  var col = SCHEMA.SETTINGS.indexOf(key) + 1;
  if (col < 1) return;
  sh.getRange(2, col).setValue(value);
}

function publicSettings_(s) {
  return {
    store_name: s.store_name,
    currency: s.currency,
    default_delivery_fee: s.default_delivery_fee,
    free_delivery_threshold: s.free_delivery_threshold,
    discount_threshold: s.discount_threshold,
    discount_rate: s.discount_rate,
    tax_rate: s.tax_rate,
    demo_mode: s.demo_mode
  };
}

function audit_(action, entityType, entityId, status, message, source) {
  try {
    appendRows_('AUDIT_LOG', [{
      timestamp: new Date(), action: action, entity_type: entityType || '', entity_id: entityId || '',
      status: status || 'OK', message: cleanText_(message || '', 500), source: source || 'api'
    }]);
  } catch (e) { /* audit must never break a request */ }
}

/** Generates the next sequential id like PREFIX-0001 by scanning a column. */
function nextSeqId_(tableName, field, prefix, width) {
  var max = 0;
  var re = new RegExp('^' + prefix.replace(/[-]/g, '\\-') + '(\\d+)$');
  readTable_(tableName).forEach(function (r) {
    var m = String(r[field]).match(re);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return prefix + pad_(max + 1, width || 4);
}

/* ==========================================================================
 * 3. VALIDATION
 * ========================================================================== */

var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validEmail_(s) { return EMAIL_RE.test(String(s || '').trim()); }

function validPhone_(s) {
  var str = String(s || '').trim();
  if (!/^\+?[0-9\s\-()]{7,20}$/.test(str)) return false;
  return str.replace(/\D/g, '').length >= 8;
}

function requireAdmin_(payload) {
  var pin = String((payload && payload.admin_pin) || '').trim();
  if (!pin || pin !== getSettings_().admin_pin) {
    Utilities.sleep(400);
    throw apiError_('UNAUTHORIZED', 'Invalid admin PIN.');
  }
}

function requirePositiveInt_(v, field, max) {
  var n = Number(v);
  if (!isFinite(n) || Math.floor(n) !== n || n <= 0 || (max && n > max)) {
    throw apiError_('VALIDATION_ERROR', field + ' must be a positive whole number' + (max ? ' up to ' + max : ''), { field: field });
  }
  return n;
}

function requireNonNegative_(v, field) {
  var n = Number(v);
  if (v === '' || v === null || v === undefined || !isFinite(n) || n < 0) {
    throw apiError_('VALIDATION_ERROR', field + ' must be zero or a positive number', { field: field });
  }
  return n;
}

function requireText_(v, field, min, max) {
  var s = String(v === undefined || v === null ? '' : v).trim();
  if (s.length < (min || 1) || s.length > (max || 500)) {
    throw apiError_('VALIDATION_ERROR', field + ' is required (' + (min || 1) + '–' + (max || 500) + ' characters)', { field: field });
  }
  return cleanText_(s, max);
}

/** Parses an optional date range {from, to} as yyyy-MM-dd keys (inclusive). */
function parseRange_(payload) {
  var from = payload && payload.from ? dateKey_(payload.from) : '';
  var to = payload && payload.to ? dateKey_(payload.to) : '';
  if (from && to && from > to) { var t = from; from = to; to = t; }
  return { from: from, to: to };
}

function inRange_(key, range) {
  if (!key) return false;
  if (range.from && key < range.from) return false;
  if (range.to && key > range.to) return false;
  return true;
}

/* ==========================================================================
 * 4. PRODUCTS
 * ========================================================================== */

var CATEGORIES = [
  { key: 'coffee-beans', name_en: 'Coffee Beans', name_hy: 'Սուրճի հատիկներ' },
  { key: 'ground-coffee', name_en: 'Ground Coffee', name_hy: 'Աղացած սուրճ' },
  { key: 'instant-coffee', name_en: 'Instant & Powder', name_hy: 'Լուծվող և փոշի սուրճ' },
  { key: 'syrups-addons', name_en: 'Syrups & Add-ons', name_hy: 'Օշարակներ և հավելումներ' },
  { key: 'filters-consumables', name_en: 'Filters & Consumables', name_hy: 'Ֆիլտրեր և ծախսանյութեր' },
  { key: 'brewing-equipment', name_en: 'Brewing Equipment', name_hy: 'Եփման սարքավորումներ' },
  { key: 'accessories-storage', name_en: 'Accessories & Storage', name_hy: 'Աքսեսուարներ և պահեստավորում' }
];

function categoryKeys_() { return CATEGORIES.map(function (c) { return c.key; }); }

/** Normalises a PRODUCTS row into a typed object (keeps _row). */
function normProduct_(r) {
  return {
    _row: r._row,
    product_id: String(r.product_id),
    sku: plain_(r.sku),
    name_hy: plain_(r.name_hy),
    name_en: plain_(r.name_en),
    category: String(r.category),
    description_hy: plain_(r.description_hy),
    description_en: plain_(r.description_en),
    origin: plain_(r.origin),
    roast_level: plain_(r.roast_level),
    grind_type: plain_(r.grind_type),
    weight_g: num_(r.weight_g),
    unit: plain_(r.unit),
    sale_price: num_(r.sale_price),
    unit_cost: num_(r.unit_cost),
    stock_qty: num_(r.stock_qty),
    reorder_level: num_(r.reorder_level),
    supplier: plain_(r.supplier),
    image_url: plain_(r.image_url),
    active: bool_(r.active),
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function allProducts_() { return readTable_('PRODUCTS').map(normProduct_); }

function productMap_() {
  var map = {};
  allProducts_().forEach(function (p) { map[p.product_id] = p; });
  return map;
}

function stockStatus_(p) {
  if (p.stock_qty <= 0) return 'out_of_stock';
  if (p.stock_qty <= p.reorder_level) return 'low_stock';
  return 'in_stock';
}

/** Customer-safe product view: no cost, no supplier. */
function publicProduct_(p) {
  return {
    product_id: p.product_id, sku: p.sku, name_hy: p.name_hy, name_en: p.name_en, category: p.category,
    description_hy: p.description_hy, description_en: p.description_en, origin: p.origin,
    roast_level: p.roast_level, grind_type: p.grind_type, weight_g: p.weight_g, unit: p.unit,
    sale_price: p.sale_price, stock_qty: Math.max(0, p.stock_qty), stock_status: stockStatus_(p),
    image_url: p.image_url, active: p.active
  };
}

/** Admin product view with financial fields. */
function adminProduct_(p) {
  var o = publicProduct_(p);
  o.unit_cost = round2_(p.unit_cost);
  o.supplier = p.supplier;
  o.reorder_level = p.reorder_level;
  o.stock_qty = p.stock_qty;
  o.unit_margin = round2_(p.sale_price - p.unit_cost);
  o.margin_percent = pct_(p.sale_price - p.unit_cost, p.sale_price);
  o.inventory_value = round2_(Math.max(0, p.stock_qty) * p.unit_cost);
  o.created_at = isoString_(p.created_at);
  o.updated_at = isoString_(p.updated_at);
  return o;
}

function apiGetProducts(payload) {
  var products = allProducts_().filter(function (p) { return p.active; }).map(publicProduct_);
  return { products: products, categories: CATEGORIES, settings: publicSettings_(getSettings_()) };
}

function apiGetProduct(payload) {
  var id = String(payload.product_id || '').trim();
  var sku = String(payload.sku || '').trim();
  var found = allProducts_().filter(function (p) {
    return p.active && ((id && p.product_id === id) || (sku && p.sku === sku));
  })[0];
  if (!found) throw apiError_('NOT_FOUND', 'Product not found.');
  return { product: publicProduct_(found) };
}

function apiGetCategories() {
  var counts = {};
  allProducts_().forEach(function (p) { if (p.active) counts[p.category] = (counts[p.category] || 0) + 1; });
  return {
    categories: CATEGORIES.map(function (c) {
      return { key: c.key, name_en: c.name_en, name_hy: c.name_hy, count: counts[c.key] || 0 };
    })
  };
}

function apiAdminProducts(payload) {
  return { products: allProducts_().map(adminProduct_), categories: CATEGORIES };
}

/** Validates editable product fields; returns cleaned values. */
function cleanProductInput_(input, isCreate) {
  var out = {};
  var textFields = { name_hy: [2, 120], name_en: [2, 120], description_hy: [0, 600], description_en: [0, 600],
    origin: [0, 80], roast_level: [0, 40], grind_type: [0, 40], unit: [0, 30], supplier: [0, 100], image_url: [0, 500] };
  Object.keys(textFields).forEach(function (f) {
    if (input[f] === undefined) { if (isCreate) out[f] = ''; return; }
    var lim = textFields[f];
    out[f] = lim[0] > 0 ? requireText_(input[f], f, lim[0], lim[1]) : cleanText_(input[f], lim[1]);
  });
  if (isCreate || input.sku !== undefined) out.sku = requireText_(input.sku, 'sku', 3, 40).toUpperCase();
  if (isCreate || input.category !== undefined) {
    if (categoryKeys_().indexOf(String(input.category)) === -1) throw apiError_('VALIDATION_ERROR', 'Unknown category', { field: 'category' });
    out.category = String(input.category);
  }
  if (isCreate || input.sale_price !== undefined) {
    out.sale_price = requireNonNegative_(input.sale_price, 'sale_price');
    if (out.sale_price <= 0) throw apiError_('VALIDATION_ERROR', 'sale_price must be greater than zero', { field: 'sale_price' });
  }
  if (input.weight_g !== undefined || isCreate) out.weight_g = num_(input.weight_g, 0);
  if (input.reorder_level !== undefined || isCreate) out.reorder_level = requireNonNegative_(num_(input.reorder_level, 0), 'reorder_level');
  if (input.active !== undefined) out.active = bool_(input.active);
  return out;
}

function apiCreateProduct(payload) {
  var input = payload.product || {};
  var clean = cleanProductInput_(input, true);
  var initialStock = num_(input.stock_qty, 0);
  var initialCost = num_(input.unit_cost, 0);
  if (initialStock < 0 || Math.floor(initialStock) !== initialStock) throw apiError_('VALIDATION_ERROR', 'stock_qty must be a whole number ≥ 0', { field: 'stock_qty' });
  if (initialCost < 0) throw apiError_('VALIDATION_ERROR', 'unit_cost must be ≥ 0', { field: 'unit_cost' });
  if (initialStock > 0 && initialCost <= 0) throw apiError_('VALIDATION_ERROR', 'unit_cost is required when opening stock is entered', { field: 'unit_cost' });

  return withLock_(function () {
    invalidate_();
    var products = allProducts_();
    if (products.some(function (p) { return p.sku === plain_(clean.sku); })) throw apiError_('DUPLICATE_SKU', 'SKU already exists.');
    var now = new Date();
    var p = {
      product_id: nextSeqId_('PRODUCTS', 'product_id', 'P-', 4),
      sku: clean.sku, name_hy: clean.name_hy, name_en: clean.name_en, category: clean.category,
      description_hy: clean.description_hy, description_en: clean.description_en, origin: clean.origin,
      roast_level: clean.roast_level, grind_type: clean.grind_type, weight_g: clean.weight_g, unit: clean.unit || 'pcs',
      sale_price: clean.sale_price, unit_cost: round2_(initialCost), stock_qty: initialStock,
      reorder_level: clean.reorder_level, supplier: clean.supplier, image_url: clean.image_url || 'art:' + clean.category,
      active: input.active === undefined ? true : bool_(input.active), created_at: now, updated_at: now
    };
    appendRows_('PRODUCTS', [p]);
    if (initialStock > 0) {
      appendRows_('INVENTORY_LOG', [{
        movement_id: nextSeqId_('INVENTORY_LOG', 'movement_id', 'MOV-', 6), date: now, product_id: p.product_id,
        sku: p.sku, movement_type: 'ADJUSTMENT', quantity_change: initialStock, stock_before: 0,
        stock_after: initialStock, unit_cost: p.unit_cost, reference_id: p.product_id,
        notes: 'Opening stock for new product', created_at: now
      }]);
    }
    audit_('createProduct', 'PRODUCT', p.product_id, 'OK', p.name_en, 'admin');
    return { product: adminProduct_(normProduct_(readTable_('PRODUCTS').filter(function (r) { return r.product_id === p.product_id; })[0])) };
  });
}

function apiUpdateProduct(payload) {
  var id = String(payload.product_id || (payload.product && payload.product.product_id) || '').trim();
  var input = payload.product || payload.changes || {};
  if (!id) throw apiError_('VALIDATION_ERROR', 'product_id is required');
  var clean = cleanProductInput_(input, false);

  return withLock_(function () {
    invalidate_();
    var rows = readTable_('PRODUCTS');
    var row = rows.filter(function (r) { return String(r.product_id) === id; })[0];
    if (!row) throw apiError_('NOT_FOUND', 'Product not found.');
    if (clean.sku && rows.some(function (r) { return String(r.product_id) !== id && plain_(r.sku) === plain_(clean.sku); })) {
      throw apiError_('DUPLICATE_SKU', 'SKU already exists.');
    }
    var before = normProduct_(row);
    Object.keys(clean).forEach(function (k) { row[k] = clean[k]; });
    var now = new Date();

    // Stock corrections are allowed but always logged as ADJUSTMENT movements.
    if (input.stock_qty !== undefined && num_(input.stock_qty) !== before.stock_qty) {
      var newStock = num_(input.stock_qty);
      if (newStock < 0 || Math.floor(newStock) !== newStock) throw apiError_('VALIDATION_ERROR', 'stock_qty must be a whole number ≥ 0', { field: 'stock_qty' });
      row.stock_qty = newStock;
      appendRows_('INVENTORY_LOG', [{
        movement_id: nextSeqId_('INVENTORY_LOG', 'movement_id', 'MOV-', 6), date: now, product_id: id, sku: before.sku,
        movement_type: 'ADJUSTMENT', quantity_change: newStock - before.stock_qty, stock_before: before.stock_qty,
        stock_after: newStock, unit_cost: before.unit_cost, reference_id: id,
        notes: cleanText_(input.adjustment_note || 'Manual stock count correction', 200), created_at: now
      }]);
    }
    row.updated_at = now;
    writeRow_('PRODUCTS', row);
    audit_('updateProduct', 'PRODUCT', id, 'OK', 'Fields: ' + Object.keys(input).join(', '), 'admin');
    return { product: adminProduct_(normProduct_(row)) };
  });
}

/* ==========================================================================
 * 5. ORDERS
 * ========================================================================== */

var ORDER_STATUSES = ['NEW', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

/** Builds a sequential order id ORD-YYYYMMDD-NNNN for a given date. */
function nextOrderId_(date) {
  var prefix = 'ORD-' + Utilities.formatDate(date, tz_(), 'yyyyMMdd') + '-';
  return nextSeqId_('ORDERS', 'order_id', prefix, 4);
}

function validateCustomer_(c) {
  var errors = [];
  var name = String(c.customer_name || c.name || '').trim();
  var email = String(c.customer_email || c.email || '').trim();
  var phone = String(c.customer_phone || c.phone || '').trim();
  var address = String(c.delivery_address || c.address || '').trim();
  var lat = Number(c.delivery_latitude !== undefined ? c.delivery_latitude : c.latitude);
  var lng = Number(c.delivery_longitude !== undefined ? c.delivery_longitude : c.longitude);
  if (name.length < 2 || name.length > 80) errors.push('customer_name');
  if (!validEmail_(email)) errors.push('customer_email');
  if (!validPhone_(phone)) errors.push('customer_phone');
  if (address.length < 5 || address.length > 250) errors.push('delivery_address');
  var hasLocation = c.delivery_latitude !== '' && c.delivery_latitude !== null && c.delivery_latitude !== undefined &&
    isFinite(lat) && isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
  if (!hasLocation) errors.push('delivery_location');
  if (errors.length) {
    var code = errors.length === 1 && errors[0] === 'delivery_location' ? 'MISSING_LOCATION' : 'VALIDATION_ERROR';
    throw apiError_(code, 'Please check: ' + errors.join(', '), { fields: errors });
  }
  return {
    customer_name: cleanText_(name, 80), customer_email: cleanText_(email.toLowerCase(), 120),
    customer_phone: cleanText_(phone, 25), company: cleanText_(c.company || '', 100),
    delivery_address: cleanText_(address, 250), delivery_latitude: round6_(lat), delivery_longitude: round6_(lng),
    delivery_notes: cleanText_(c.delivery_notes || c.notes || '', 500)
  };
}

function round6_(n) { return Math.round(Number(n) * 1e6) / 1e6; }

/** Merges duplicate cart lines and validates quantities. Prices are ignored. */
function normaliseCart_(items) {
  if (!items || !items.length) throw apiError_('EMPTY_CART', 'Your cart is empty.');
  if (items.length > 60) throw apiError_('VALIDATION_ERROR', 'Too many cart lines.');
  var merged = {};
  var order = [];
  items.forEach(function (it) {
    var id = String(it.product_id || '').trim();
    if (!id) throw apiError_('VALIDATION_ERROR', 'Cart item without product_id');
    var q = requirePositiveInt_(it.quantity !== undefined ? it.quantity : it.qty, 'quantity', 99);
    if (!merged[id]) { merged[id] = 0; order.push(id); }
    merged[id] += q;
  });
  return order.map(function (id) { return { product_id: id, quantity: merged[id] }; });
}

/** Core order writer used by the API and the seed engine. Must run inside a lock. */
function apiCreateOrder(payload) {
  var customer = validateCustomer_(payload.customer || payload);
  var cart = normaliseCart_(payload.items);
  var requestId = String(payload.client_request_id || '').substring(0, 80);
  var cache = CacheService.getScriptCache();
  if (requestId) {
    var prior = cache.get('order_req_' + requestId);
    if (prior) return JSON.parse(prior);
  }

  var result = withLock_(function () {
    invalidate_();
    // Re-check idempotency inside the lock (two parallel submits).
    if (requestId) {
      var again = cache.get('order_req_' + requestId);
      if (again) return JSON.parse(again);
    }
    var settings = getSettings_();
    var pmap = productMap_();
    var problems = [];
    var lines = cart.map(function (c) {
      var p = pmap[c.product_id];
      if (!p || !p.active) { problems.push({ product_id: c.product_id, reason: 'UNAVAILABLE', available: 0 }); return null; }
      if (p.stock_qty < c.quantity) {
        problems.push({ product_id: c.product_id, name_en: p.name_en, name_hy: p.name_hy, reason: 'OUT_OF_STOCK', available: Math.max(0, p.stock_qty) });
        return null;
      }
      return { product: p, quantity: c.quantity, price: p.sale_price, cost: p.unit_cost };
    });
    if (problems.length) {
      var allUnavailable = problems.every(function (x) { return x.reason === 'UNAVAILABLE'; });
      throw apiError_(allUnavailable ? 'PRODUCT_UNAVAILABLE' : 'OUT_OF_STOCK', 'Some items are no longer available in the requested quantity.', { items: problems });
    }

    var totals = calcOrderTotals_(lines.map(function (l) { return { quantity: l.quantity, price: l.price, cost: l.cost }; }), settings);
    var now = new Date();
    var orderId = nextOrderId_(now);
    var order = {
      order_id: orderId, order_date: now,
      customer_name: customer.customer_name, customer_email: customer.customer_email,
      customer_phone: customer.customer_phone, company: customer.company,
      delivery_address: customer.delivery_address, delivery_latitude: customer.delivery_latitude,
      delivery_longitude: customer.delivery_longitude, delivery_notes: customer.delivery_notes,
      subtotal: totals.subtotal, discount: totals.discount, delivery_fee: totals.delivery_fee,
      total_amount: totals.total_amount, currency: settings.currency, total_cogs: totals.total_cogs,
      gross_profit: totals.gross_profit, gross_margin_percent: totals.gross_margin_percent,
      payment_method: 'CASH_ON_DELIVERY', payment_status: 'PENDING', order_status: 'NEW',
      created_at: now, updated_at: now
    };

    var itemRows = [];
    var logRows = [];
    var movSeq = Number(nextSeqId_('INVENTORY_LOG', 'movement_id', 'MOV-', 6).replace('MOV-', ''));
    lines.forEach(function (l, i) {
      var p = l.product;
      var lineRevenue = l.quantity * l.price;
      var lineCogs = round2_(l.quantity * l.cost);
      itemRows.push({
        order_item_id: orderId + '-' + pad_(i + 1, 2), order_id: orderId, product_id: p.product_id, sku: p.sku,
        product_name: p.name_en, quantity: l.quantity, unit_sale_price: l.price, unit_cost: round2_(l.cost),
        line_revenue: lineRevenue, line_cogs: lineCogs, line_profit: round2_(lineRevenue - lineCogs), created_at: now
      });
      var before = p.stock_qty;
      var after = before - l.quantity;
      logRows.push({
        movement_id: 'MOV-' + pad_(movSeq++, 6), date: now, product_id: p.product_id, sku: p.sku,
        movement_type: 'SALE', quantity_change: -l.quantity, stock_before: before, stock_after: after,
        unit_cost: round2_(l.cost), reference_id: orderId, notes: 'Customer order', created_at: now
      });
      p.stock_qty = after;
      p.updated_at = now;
    });

    appendRows_('ORDERS', [order]);
    appendRows_('ORDER_ITEMS', itemRows);
    // Update each sold product row (stock + updated_at).
    var productRows = readTable_('PRODUCTS');
    var rowById = {};
    productRows.forEach(function (r) { rowById[String(r.product_id)] = r; });
    lines.forEach(function (l) {
      var row = rowById[l.product.product_id];
      row.stock_qty = l.product.stock_qty;
      row.updated_at = now;
      writeRow_('PRODUCTS', row);
    });
    appendRows_('INVENTORY_LOG', logRows);

    var response = {
      order_id: orderId,
      order_date: isoString_(now),
      order_status: 'NEW',
      payment_method: 'CASH_ON_DELIVERY',
      payment_status: 'PENDING',
      currency: settings.currency,
      subtotal: totals.subtotal,
      discount: totals.discount,
      delivery_fee: totals.delivery_fee,
      total_amount: totals.total_amount,
      items: itemRows.map(function (r) {
        var p = pmap[r.product_id];
        return { product_id: r.product_id, sku: r.sku, name_en: p.name_en, name_hy: p.name_hy, category: p.category,
          image_url: p.image_url, quantity: r.quantity, unit_price: r.unit_sale_price, line_total: r.line_revenue };
      }),
      delivery: { address: customer.delivery_address, latitude: customer.delivery_latitude,
        longitude: customer.delivery_longitude, notes: customer.delivery_notes },
      customer: { name: customer.customer_name, email: customer.customer_email }
    };
    if (requestId) cache.put('order_req_' + requestId, JSON.stringify(response), 21600);
    return response;
  });

  try { rebuildReports_(); } catch (e) { audit_('rebuildReports', 'REPORT', '', 'ERROR', String(e), 'system'); }
  audit_('createOrder', 'ORDER', result.order_id, 'OK', 'Total ' + result.total_amount + ' ' + result.currency, 'storefront');
  return result;
}

function orderView_(r, items, admin) {
  var o = {
    order_id: String(r.order_id), order_date: isoString_(r.order_date), customer_name: plain_(r.customer_name),
    customer_email: plain_(r.customer_email), customer_phone: plain_(r.customer_phone), company: plain_(r.company),
    delivery_address: plain_(r.delivery_address), delivery_latitude: num_(r.delivery_latitude),
    delivery_longitude: num_(r.delivery_longitude), delivery_notes: plain_(r.delivery_notes),
    subtotal: num_(r.subtotal), discount: num_(r.discount), delivery_fee: num_(r.delivery_fee),
    total_amount: num_(r.total_amount), currency: String(r.currency || APP.CURRENCY),
    payment_method: String(r.payment_method), payment_status: String(r.payment_status),
    order_status: String(r.order_status), updated_at: isoString_(r.updated_at)
  };
  if (admin) {
    o.total_cogs = num_(r.total_cogs);
    o.gross_profit = num_(r.gross_profit);
    o.gross_margin_percent = num_(r.gross_margin_percent);
  }
  if (items) {
    var pmap = productMap_();
    o.items = items.map(function (it) {
      var p = pmap[String(it.product_id)] || {};
      var v = {
        product_id: String(it.product_id), sku: plain_(it.sku), product_name: plain_(it.product_name),
        name_en: p.name_en || plain_(it.product_name), name_hy: p.name_hy || plain_(it.product_name),
        category: p.category || '', image_url: p.image_url || '', quantity: num_(it.quantity),
        unit_price: num_(it.unit_sale_price), line_total: num_(it.line_revenue)
      };
      if (admin) {
        v.unit_cost = num_(it.unit_cost); v.line_cogs = num_(it.line_cogs); v.line_profit = num_(it.line_profit);
      }
      return v;
    });
    o.units = o.items.reduce(function (s, it) { return s + it.quantity; }, 0);
  }
  return o;
}

function itemsByOrder_() {
  var map = {};
  readTable_('ORDER_ITEMS').forEach(function (it) {
    var k = String(it.order_id);
    (map[k] = map[k] || []).push(it);
  });
  return map;
}

/** Public lookup requires order id + matching email; admins may omit email. */
function apiGetOrder(payload) {
  var id = String(payload.order_id || '').trim().toUpperCase();
  var isAdmin = false;
  if (payload.admin_pin) { requireAdmin_(payload); isAdmin = true; }
  var row = readTable_('ORDERS').filter(function (r) { return String(r.order_id).toUpperCase() === id; })[0];
  if (!row) throw apiError_('ORDER_NOT_FOUND', 'Order not found.');
  if (!isAdmin && plain_(row.customer_email).toLowerCase() !== String(payload.email || '').trim().toLowerCase()) {
    throw apiError_('ORDER_NOT_FOUND', 'Order not found.');
  }
  return { order: orderView_(row, itemsByOrder_()[String(row.order_id)] || [], isAdmin) };
}

function apiGetOrders(payload) {
  var range = parseRange_(payload);
  var status = String(payload.status || '').toUpperCase();
  var q = String(payload.search || '').trim().toLowerCase();
  var items = itemsByOrder_();
  var list = readTable_('ORDERS').filter(function (r) {
    if (status && String(r.order_status) !== status) return false;
    if ((range.from || range.to) && !inRange_(dateKey_(r.order_date), range)) return false;
    if (q) {
      var hay = [r.order_id, r.customer_name, r.customer_email, r.customer_phone, r.company, r.delivery_address].join(' ').toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }).map(function (r) { return orderView_(r, items[String(r.order_id)] || [], true); });
  list.sort(function (a, b) { return a.order_date < b.order_date ? 1 : -1; });
  return { orders: list, statuses: ORDER_STATUSES };
}

/** Status workflow. Cancelling returns stock to inventory (RETURN movements). */
function apiUpdateOrderStatus(payload) {
  var id = String(payload.order_id || '').trim();
  var status = String(payload.status || payload.order_status || '').toUpperCase();
  if (ORDER_STATUSES.indexOf(status) === -1) throw apiError_('VALIDATION_ERROR', 'Unknown order status', { field: 'status' });

  var result = withLock_(function () {
    invalidate_();
    var row = readTable_('ORDERS').filter(function (r) { return String(r.order_id) === id; })[0];
    if (!row) throw apiError_('ORDER_NOT_FOUND', 'Order not found.');
    var current = String(row.order_status);
    if (current === status) return { order_id: id, order_status: status, changed: false };
    if (current === 'CANCELLED') throw apiError_('INVALID_TRANSITION', 'Cancelled orders cannot be reopened.');
    if (current === 'DELIVERED' && status !== 'CANCELLED') throw apiError_('INVALID_TRANSITION', 'Delivered orders can only be cancelled (returned).');

    var now = new Date();
    if (status === 'CANCELLED') {
      var items = itemsByOrder_()[id] || [];
      var movSeq = Number(nextSeqId_('INVENTORY_LOG', 'movement_id', 'MOV-', 6).replace('MOV-', ''));
      var logs = [];
      var prodRows = {};
      readTable_('PRODUCTS').forEach(function (r) { prodRows[String(r.product_id)] = r; });
      items.forEach(function (it) {
        var prow = prodRows[String(it.product_id)];
        if (!prow) return;
        var p = normProduct_(prow);
        var qty = num_(it.quantity);
        var newCost = weightedAverageCost_(p.stock_qty, p.unit_cost, qty, num_(it.unit_cost));
        logs.push({
          movement_id: 'MOV-' + pad_(movSeq++, 6), date: now, product_id: p.product_id, sku: p.sku,
          movement_type: 'RETURN', quantity_change: qty, stock_before: p.stock_qty, stock_after: p.stock_qty + qty,
          unit_cost: num_(it.unit_cost), reference_id: id, notes: 'Order cancelled — stock returned', created_at: now
        });
        prow.stock_qty = p.stock_qty + qty;
        prow.unit_cost = newCost;
        prow.updated_at = now;
        writeRow_('PRODUCTS', prow);
      });
      appendRows_('INVENTORY_LOG', logs);
      row.payment_status = 'VOID';
    } else if (status === 'DELIVERED') {
      row.payment_status = 'PAID';
    }
    row.order_status = status;
    row.updated_at = now;
    writeRow_('ORDERS', row);
    return { order_id: id, order_status: status, payment_status: String(row.payment_status), changed: true };
  });
  if (result.changed) {
    try { rebuildReports_(); } catch (e) { /* non-fatal */ }
    audit_('updateOrderStatus', 'ORDER', id, 'OK', 'Status → ' + status, 'admin');
  }
  return result;
}

/* ==========================================================================
 * 6. INVENTORY & PURCHASES
 * ========================================================================== */

/**
 * Weighted average cost:
 *   (existing stock × old cost + purchased qty × new cost) / (existing stock + purchased qty)
 * Negative/zero existing stock simply adopts the new cost.
 */
function weightedAverageCost_(stock, oldCost, qty, newCost) {
  var s = Math.max(0, num_(stock));
  var q = num_(qty);
  if (s + q <= 0) return round2_(newCost);
  return round2_((s * num_(oldCost) + q * num_(newCost)) / (s + q));
}

function apiAddPurchase(payload) {
  var p = payload.purchase || payload;
  var productId = String(p.product_id || '').trim();
  var qty = requirePositiveInt_(p.quantity, 'quantity', 100000);
  var unitCost = requireNonNegative_(p.unit_cost, 'unit_cost');
  if (unitCost <= 0) throw apiError_('VALIDATION_ERROR', 'unit_cost must be greater than zero', { field: 'unit_cost' });
  var date = p.purchase_date ? toDate_(p.purchase_date) : new Date();
  if (!date) throw apiError_('VALIDATION_ERROR', 'Invalid purchase_date', { field: 'purchase_date' });

  var result = withLock_(function () {
    invalidate_();
    var prow = readTable_('PRODUCTS').filter(function (r) { return String(r.product_id) === productId; })[0];
    if (!prow) throw apiError_('NOT_FOUND', 'Product not found.');
    var product = normProduct_(prow);
    var now = new Date();
    var supplier = cleanText_(p.supplier || product.supplier, 100);
    var purchaseId = nextSeqId_('PURCHASES', 'purchase_id', 'PUR-', 4);
    var newCost = weightedAverageCost_(product.stock_qty, product.unit_cost, qty, unitCost);
    var stockAfter = product.stock_qty + qty;
    var purchase = {
      purchase_id: purchaseId, purchase_date: date, supplier: supplier, product_id: productId, sku: product.sku,
      quantity: qty, unit_cost: round2_(unitCost), total_cost: round2_(qty * unitCost), currency: getSettings_().currency,
      invoice_reference: cleanText_(p.invoice_reference || '', 60), notes: cleanText_(p.notes || '', 300), created_at: now
    };
    appendRows_('PURCHASES', [purchase]);
    appendRows_('INVENTORY_LOG', [{
      movement_id: nextSeqId_('INVENTORY_LOG', 'movement_id', 'MOV-', 6), date: date, product_id: productId,
      sku: product.sku, movement_type: 'PURCHASE', quantity_change: qty, stock_before: product.stock_qty,
      stock_after: stockAfter, unit_cost: round2_(unitCost), reference_id: purchaseId,
      notes: 'Supplier purchase · ' + supplier, created_at: now
    }]);
    prow.stock_qty = stockAfter;
    prow.unit_cost = newCost;
    prow.updated_at = now;
    writeRow_('PRODUCTS', prow);
    return {
      purchase: purchaseView_(purchase),
      inventory: {
        product_id: productId, name_en: product.name_en, name_hy: product.name_hy,
        stock_before: product.stock_qty, stock_after: stockAfter,
        cost_before: round2_(product.unit_cost), cost_after: newCost,
        inventory_value_after: round2_(stockAfter * newCost)
      }
    };
  });
  audit_('addPurchase', 'PURCHASE', result.purchase.purchase_id, 'OK', qty + ' × ' + productId, 'admin');
  return result;
}

function purchaseView_(r) {
  return {
    purchase_id: String(r.purchase_id), purchase_date: dateKey_(r.purchase_date), supplier: plain_(r.supplier),
    product_id: String(r.product_id), sku: plain_(r.sku), quantity: num_(r.quantity), unit_cost: num_(r.unit_cost),
    total_cost: num_(r.total_cost), currency: String(r.currency || APP.CURRENCY),
    invoice_reference: plain_(r.invoice_reference), notes: plain_(r.notes)
  };
}

function apiGetPurchases(payload) {
  var range = parseRange_(payload);
  var pmap = productMap_();
  var list = readTable_('PURCHASES').filter(function (r) {
    return !(range.from || range.to) || inRange_(dateKey_(r.purchase_date), range);
  }).map(function (r) {
    var v = purchaseView_(r);
    var p = pmap[v.product_id] || {};
    v.name_en = p.name_en || v.sku;
    v.name_hy = p.name_hy || v.sku;
    return v;
  });
  list.sort(function (a, b) { return a.purchase_date < b.purchase_date ? 1 : (a.purchase_date > b.purchase_date ? -1 : (a.purchase_id < b.purchase_id ? 1 : -1)); });
  var total = list.reduce(function (s, x) { return s + x.total_cost; }, 0);
  return { purchases: list, total_cost: round2_(total) };
}

function apiGetInventory(payload) {
  var products = allProducts_().map(adminProduct_);
  var limit = Math.min(500, num_(payload.log_limit, 150));
  var log = readTable_('INVENTORY_LOG').map(function (r) {
    return {
      movement_id: String(r.movement_id), date: isoString_(r.date), product_id: String(r.product_id), sku: plain_(r.sku),
      movement_type: String(r.movement_type), quantity_change: num_(r.quantity_change), stock_before: num_(r.stock_before),
      stock_after: num_(r.stock_after), unit_cost: num_(r.unit_cost), reference_id: String(r.reference_id), notes: plain_(r.notes)
    };
  });
  log.sort(function (a, b) { return a.date < b.date ? 1 : (a.date > b.date ? -1 : (a.movement_id < b.movement_id ? 1 : -1)); });
  var value = products.reduce(function (s, p) { return s + p.inventory_value; }, 0);
  return {
    products: products,
    movements: log.slice(0, limit),
    summary: {
      inventory_value: round2_(value),
      units_in_stock: products.reduce(function (s, p) { return s + Math.max(0, p.stock_qty); }, 0),
      low_stock_count: products.filter(function (p) { return p.active && p.stock_status === 'low_stock'; }).length,
      out_of_stock_count: products.filter(function (p) { return p.active && p.stock_status === 'out_of_stock'; }).length,
      sku_count: products.length
    }
  };
}

/* ==========================================================================
 * 7. FINANCE ENGINE
 *    Revenue        = Σ(quantity × sale price) − discounts   (net sales)
 *    COGS           = Σ(quantity × unit cost at time of sale)
 *    Gross Profit   = Revenue − COGS
 *    Gross Margin % = Gross Profit / Revenue × 100
 *    Net Profit     = Gross Profit + Delivery Income − Operating Expenses
 *    AOV            = Revenue / Number of Orders
 *    Cancelled orders are excluded everywhere.
 * ========================================================================== */

/**
 * Pure order calculator — shared by live checkout and the seed generator.
 * lines: [{quantity, price, cost}]
 */
function calcOrderTotals_(lines, settings) {
  var subtotal = 0, cogs = 0, units = 0;
  lines.forEach(function (l) {
    subtotal += num_(l.quantity) * num_(l.price);
    cogs += num_(l.quantity) * num_(l.cost);
    units += num_(l.quantity);
  });
  subtotal = roundInt_(subtotal);
  var discount = 0;
  if (settings.discount_rate > 0 && settings.discount_threshold > 0 && subtotal >= settings.discount_threshold) {
    discount = roundInt_(subtotal * settings.discount_rate / 100);
  }
  var net = subtotal - discount;
  var deliveryFee = settings.free_delivery_threshold > 0 && net >= settings.free_delivery_threshold ? 0 : roundInt_(settings.default_delivery_fee);
  if (units === 0) deliveryFee = 0;
  cogs = round2_(cogs);
  var grossProfit = round2_(net - cogs);
  return {
    units: units,
    subtotal: subtotal,
    discount: discount,
    net_revenue: net,
    delivery_fee: deliveryFee,
    total_amount: net + deliveryFee,
    total_cogs: cogs,
    gross_profit: grossProfit,
    gross_margin_percent: pct_(grossProfit, net)
  };
}

function emptyAgg_() {
  return { orders: 0, units_sold: 0, gross_sales: 0, discounts: 0, revenue: 0, delivery_income: 0,
    cogs: 0, gross_profit: 0, operating_expenses: 0 };
}

function finishAgg_(a) {
  a.gross_sales = round2_(a.gross_sales);
  a.discounts = round2_(a.discounts);
  a.revenue = round2_(a.revenue);
  a.delivery_income = round2_(a.delivery_income);
  a.cogs = round2_(a.cogs);
  a.gross_profit = round2_(a.revenue - a.cogs);
  a.operating_expenses = round2_(a.operating_expenses);
  a.gross_margin = pct_(a.gross_profit, a.revenue);
  a.net_profit = round2_(a.gross_profit + a.delivery_income - a.operating_expenses);
  a.net_margin = pct_(a.net_profit, a.revenue + a.delivery_income);
  a.average_order_value = round2_(safeDiv_(a.revenue, a.orders));
  return a;
}

function addOrderToAgg_(a, o, units) {
  a.orders += 1;
  a.units_sold += units;
  a.gross_sales += num_(o.subtotal);
  a.discounts += num_(o.discount);
  a.revenue += num_(o.subtotal) - num_(o.discount);
  a.delivery_income += num_(o.delivery_fee);
  a.cogs += num_(o.total_cogs);
}

function liveOrders_() {
  return readTable_('ORDERS').filter(function (o) { return String(o.order_status) !== 'CANCELLED'; });
}

function unitsByOrder_() {
  var m = {};
  readTable_('ORDER_ITEMS').forEach(function (it) { m[String(it.order_id)] = (m[String(it.order_id)] || 0) + num_(it.quantity); });
  return m;
}

/** Lists yyyy-MM-dd keys between two keys inclusive (max 731 days). */
function dayKeysBetween_(from, to) {
  var out = [];
  var d = toDate_(from);
  var end = toDate_(to);
  if (!d || !end) return out;
  var guard = 0;
  while (guard++ < 731) {
    var k = Utilities.formatDate(d, tz_(), 'yyyy-MM-dd');
    if (k > to) break;
    out.push(k);
    d = new Date(d.getTime() + 24 * 3600 * 1000);
  }
  return out;
}

/** Full financial analysis for an optional date range. */
function computeFinancials_(range) {
  range = range || { from: '', to: '' };
  var hasRange = !!(range.from || range.to);
  var ordersAll = readTable_('ORDERS');
  var orders = liveOrders_().filter(function (o) { return !hasRange || inRange_(dateKey_(o.order_date), range); });
  var orderIds = {};
  orders.forEach(function (o) { orderIds[String(o.order_id)] = o; });
  var items = readTable_('ORDER_ITEMS').filter(function (it) { return orderIds[String(it.order_id)]; });
  var expenses = readTable_('EXPENSES').filter(function (e) { return !hasRange || inRange_(dateKey_(e.expense_date), range); });
  var purchases = readTable_('PURCHASES').filter(function (p) { return !hasRange || inRange_(dateKey_(p.purchase_date), range); });
  var products = allProducts_();
  var pmap = {};
  products.forEach(function (p) { pmap[p.product_id] = p; });
  var unitsMap = {};
  items.forEach(function (it) { unitsMap[String(it.order_id)] = (unitsMap[String(it.order_id)] || 0) + num_(it.quantity); });

  // ---- Summary
  var s = emptyAgg_();
  orders.forEach(function (o) { addOrderToAgg_(s, o, unitsMap[String(o.order_id)] || 0); });
  expenses.forEach(function (e) { s.operating_expenses += num_(e.amount); });
  finishAgg_(s);

  // ---- Daily series
  var dayMap = {};
  orders.forEach(function (o) {
    var k = dateKey_(o.order_date);
    addOrderToAgg_(dayMap[k] = dayMap[k] || emptyAgg_(), o, unitsMap[String(o.order_id)] || 0);
  });
  expenses.forEach(function (e) {
    var k = dateKey_(e.expense_date);
    (dayMap[k] = dayMap[k] || emptyAgg_()).operating_expenses += num_(e.amount);
  });
  var keys = Object.keys(dayMap).sort();
  var from = range.from || keys[0] || dateKey_(new Date());
  var today = dateKey_(new Date());
  var to = range.to && range.to < today ? range.to : today; // never chart future days
  if (keys.length && keys[keys.length - 1] > to) to = keys[keys.length - 1];
  if (from > to) from = to;
  var daily = dayKeysBetween_(from, to).map(function (k) {
    var a = finishAgg_(dayMap[k] || emptyAgg_());
    a.date = k;
    return a;
  });

  // ---- Monthly series
  var monthMap = {};
  daily.forEach(function (d) {
    var mk = d.date.substring(0, 7);
    var m = monthMap[mk] = monthMap[mk] || emptyAgg_();
    m.orders += d.orders; m.units_sold += d.units_sold; m.gross_sales += d.gross_sales; m.discounts += d.discounts;
    m.revenue += d.revenue; m.delivery_income += d.delivery_income; m.cogs += d.cogs; m.operating_expenses += d.operating_expenses;
  });
  var monthly = Object.keys(monthMap).sort().map(function (mk) { var m = finishAgg_(monthMap[mk]); m.month = mk; return m; });

  // ---- Product & category analysis (line values before order-level discount)
  var prodAgg = {};
  var catAgg = {};
  items.forEach(function (it) {
    var pid = String(it.product_id);
    var p = pmap[pid] || {};
    var pa = prodAgg[pid] = prodAgg[pid] || { product_id: pid, sku: plain_(it.sku), name_en: p.name_en || plain_(it.product_name),
      name_hy: p.name_hy || plain_(it.product_name), category: p.category || 'other', quantity: 0, revenue: 0, cogs: 0, profit: 0 };
    pa.quantity += num_(it.quantity); pa.revenue += num_(it.line_revenue); pa.cogs += num_(it.line_cogs); pa.profit += num_(it.line_profit);
    var ck = p.category || 'other';
    var ca = catAgg[ck] = catAgg[ck] || { category: ck, quantity: 0, revenue: 0, cogs: 0, profit: 0 };
    ca.quantity += num_(it.quantity); ca.revenue += num_(it.line_revenue); ca.cogs += num_(it.line_cogs); ca.profit += num_(it.line_profit);
  });
  var productSales = Object.keys(prodAgg).map(function (k) {
    var x = prodAgg[k];
    x.revenue = round2_(x.revenue); x.cogs = round2_(x.cogs); x.profit = round2_(x.profit); x.margin = pct_(x.profit, x.revenue);
    return x;
  });
  var byCategory = CATEGORIES.map(function (c) {
    var x = catAgg[c.key] || { category: c.key, quantity: 0, revenue: 0, cogs: 0, profit: 0 };
    return { category: c.key, name_en: c.name_en, name_hy: c.name_hy, quantity: x.quantity, revenue: round2_(x.revenue),
      cogs: round2_(x.cogs), profit: round2_(x.profit), margin: pct_(x.profit, x.revenue) };
  });
  var topProducts = productSales.slice().sort(function (a, b) { return b.quantity - a.quantity || b.revenue - a.revenue; }).slice(0, 10);
  var mostProfitable = productSales.slice().sort(function (a, b) { return b.profit - a.profit; }).slice(0, 10);

  // ---- Expenses
  var expCat = {};
  expenses.forEach(function (e) { var k = String(e.category || 'OTHER'); expCat[k] = (expCat[k] || 0) + num_(e.amount); });
  var expensesByCategory = Object.keys(expCat).map(function (k) { return { category: k, amount: round2_(expCat[k]) }; })
    .sort(function (a, b) { return b.amount - a.amount; });

  // ---- Purchases
  var supAgg = {};
  purchases.forEach(function (p) {
    var k = plain_(p.supplier) || '—';
    var x = supAgg[k] = supAgg[k] || { supplier: k, quantity: 0, total_cost: 0, purchases: 0 };
    x.quantity += num_(p.quantity); x.total_cost += num_(p.total_cost); x.purchases += 1;
  });
  var purchasesBySupplier = Object.keys(supAgg).map(function (k) { supAgg[k].total_cost = round2_(supAgg[k].total_cost); return supAgg[k]; })
    .sort(function (a, b) { return b.total_cost - a.total_cost; });
  var purchaseList = purchases.map(function (r) {
    var v = purchaseView_(r); var p = pmap[v.product_id] || {}; v.name_en = p.name_en || v.sku; v.name_hy = p.name_hy || v.sku; return v;
  }).sort(function (a, b) { return a.purchase_date < b.purchase_date ? 1 : -1; });
  var totalPurchases = round2_(purchases.reduce(function (t, p) { return t + num_(p.total_cost); }, 0));

  // ---- Inventory (always current state)
  var activeProducts = products.filter(function (p) { return p.active; });
  var inventoryValue = round2_(products.reduce(function (t, p) { return t + Math.max(0, p.stock_qty) * p.unit_cost; }, 0));
  var lowStock = activeProducts.filter(function (p) { return p.stock_qty <= p.reorder_level; })
    .sort(function (a, b) { return a.stock_qty - b.stock_qty; })
    .map(function (p) {
      return { product_id: p.product_id, sku: p.sku, name_en: p.name_en, name_hy: p.name_hy, category: p.category,
        stock_qty: p.stock_qty, reorder_level: p.reorder_level, status: stockStatus_(p), supplier: p.supplier };
    });
  var inventoryByCategory = CATEGORIES.map(function (c) {
    var list = products.filter(function (p) { return p.category === c.key; });
    return { category: c.key, name_en: c.name_en, name_hy: c.name_hy, skus: list.length,
      units: list.reduce(function (t, p) { return t + Math.max(0, p.stock_qty); }, 0),
      value: round2_(list.reduce(function (t, p) { return t + Math.max(0, p.stock_qty) * p.unit_cost; }, 0)) };
  });

  // ---- Order status breakdown (all statuses, within range)
  var statusCounts = {};
  ORDER_STATUSES.forEach(function (st) { statusCounts[st] = 0; });
  ordersAll.forEach(function (o) {
    if (!hasRange || inRange_(dateKey_(o.order_date), range)) statusCounts[String(o.order_status)] = (statusCounts[String(o.order_status)] || 0) + 1;
  });

  s.total_purchases = totalPurchases;
  s.inventory_value = inventoryValue;
  s.low_stock_count = lowStock.filter(function (x) { return x.status === 'low_stock'; }).length;
  s.out_of_stock_count = lowStock.filter(function (x) { return x.status === 'out_of_stock'; }).length;
  s.active_products = activeProducts.length;
  s.total_collected = round2_(orders.reduce(function (t, o) { return t + num_(o.total_amount); }, 0));
  s.pending_orders = (statusCounts.NEW || 0) + (statusCounts.CONFIRMED || 0) + (statusCounts.SHIPPED || 0);
  s.cancelled_orders = statusCounts.CANCELLED || 0;

  return {
    range: { from: from, to: to, all_time: !hasRange },
    summary: s,
    daily: daily,
    monthly: monthly,
    by_category: byCategory,
    top_products: topProducts,
    most_profitable: mostProfitable,
    product_sales: productSales.sort(function (a, b) { return b.revenue - a.revenue; }),
    expenses_by_category: expensesByCategory,
    expenses: expenses.map(expenseView_).sort(function (a, b) { return a.expense_date < b.expense_date ? 1 : -1; }),
    purchases_by_supplier: purchasesBySupplier,
    purchases: purchaseList,
    low_stock: lowStock,
    inventory_by_category: inventoryByCategory,
    status_counts: statusCounts,
    generated_at: isoString_(new Date())
  };
}

function apiGetDashboard(payload) {
  var f = computeFinancials_(parseRange_(payload));
  return {
    range: f.range, summary: f.summary, daily: f.daily, monthly: f.monthly, by_category: f.by_category,
    top_products: f.top_products, most_profitable: f.most_profitable, expenses_by_category: f.expenses_by_category,
    low_stock: f.low_stock, status_counts: f.status_counts, purchases_by_supplier: f.purchases_by_supplier,
    inventory_by_category: f.inventory_by_category, generated_at: f.generated_at
  };
}

function apiGetFinancialReport(payload) {
  return computeFinancials_(parseRange_(payload));
}

/* ==========================================================================
 * 8. REPORTS — REPORT_DAILY / REPORT_MONTHLY rebuilt from transactions
 * ========================================================================== */

function rebuildReports_() {
  var units = unitsByOrder_();
  var day = {}, month = {};
  liveOrders_().forEach(function (o) {
    var dk = dateKey_(o.order_date), mk = monthKey_(o.order_date);
    addOrderToAgg_(day[dk] = day[dk] || emptyAgg_(), o, units[String(o.order_id)] || 0);
    addOrderToAgg_(month[mk] = month[mk] || emptyAgg_(), o, units[String(o.order_id)] || 0);
  });
  readTable_('EXPENSES').forEach(function (e) {
    var dk = dateKey_(e.expense_date), mk = monthKey_(e.expense_date);
    if (!dk) return;
    (day[dk] = day[dk] || emptyAgg_()).operating_expenses += num_(e.amount);
    (month[mk] = month[mk] || emptyAgg_()).operating_expenses += num_(e.amount);
  });
  var toRow = function (a, keyName, key) {
    finishAgg_(a);
    var r = { orders: a.orders, units_sold: a.units_sold, revenue: a.revenue, discounts: a.discounts,
      delivery_income: a.delivery_income, cogs: a.cogs, gross_profit: a.gross_profit, gross_margin: a.gross_margin,
      operating_expenses: a.operating_expenses, net_profit: a.net_profit, average_order_value: a.average_order_value };
    r[keyName] = key;
    return r;
  };
  // Keys are written with a leading apostrophe so Sheets keeps them as text.
  replaceTable_('REPORT_DAILY', Object.keys(day).sort().map(function (k) { return toRow(day[k], 'date', "'" + k); }));
  replaceTable_('REPORT_MONTHLY', Object.keys(month).sort().map(function (k) { return toRow(month[k], 'month', "'" + k); }));
  return { days: Object.keys(day).length, months: Object.keys(month).length };
}

function apiRebuildReports() {
  var r = rebuildReports_();
  audit_('rebuildReports', 'REPORT', '', 'OK', r.days + ' days, ' + r.months + ' months', 'admin');
  return r;
}

/** Reads stored report rows (for the admin "Daily / Monthly" views). */
function apiGetReportTables(payload) {
  var range = parseRange_(payload);
  var map = function (name, keyField) {
    return readTable_(name).map(function (r) {
      var o = {}; SCHEMA[name].forEach(function (h) { o[h] = h === keyField ? plain_(r[h] instanceof Date ? (keyField === 'date' ? dateKey_(r[h]) : monthKey_(r[h])) : r[h]) : num_(r[h]); });
      return o;
    });
  };
  var daily = map('REPORT_DAILY', 'date').filter(function (r) { return !(range.from || range.to) || inRange_(r.date, range); });
  var monthly = map('REPORT_MONTHLY', 'month').filter(function (r) {
    if (!(range.from || range.to)) return true;
    return (!range.from || r.month >= range.from.substring(0, 7)) && (!range.to || r.month <= range.to.substring(0, 7));
  });
  return { daily: daily, monthly: monthly };
}

/* ==========================================================================
 * 10. EXPENSES
 * ========================================================================== */

var EXPENSE_CATEGORIES = ['RENT', 'SALARIES', 'MARKETING', 'PACKAGING', 'DELIVERY', 'UTILITIES', 'SOFTWARE', 'SUPPLIES', 'OTHER'];

function expenseView_(r) {
  return {
    expense_id: String(r.expense_id), expense_date: dateKey_(r.expense_date), category: String(r.category),
    description: plain_(r.description), amount: num_(r.amount), currency: String(r.currency || APP.CURRENCY), notes: plain_(r.notes)
  };
}

function cleanExpense_(e) {
  var category = String(e.category || '').toUpperCase();
  if (EXPENSE_CATEGORIES.indexOf(category) === -1) throw apiError_('VALIDATION_ERROR', 'Unknown expense category', { field: 'category' });
  var amount = requireNonNegative_(e.amount, 'amount');
  if (amount <= 0) throw apiError_('VALIDATION_ERROR', 'amount must be greater than zero', { field: 'amount' });
  var date = e.expense_date ? toDate_(e.expense_date) : new Date();
  if (!date) throw apiError_('VALIDATION_ERROR', 'Invalid expense_date', { field: 'expense_date' });
  return { expense_date: date, category: category, description: requireText_(e.description, 'description', 2, 200),
    amount: round2_(amount), notes: cleanText_(e.notes || '', 300) };
}

function apiAddExpense(payload) {
  var clean = cleanExpense_(payload.expense || payload);
  var exp = withLock_(function () {
    invalidate_();
    var row = { expense_id: nextSeqId_('EXPENSES', 'expense_id', 'EXP-', 4), expense_date: clean.expense_date,
      category: clean.category, description: clean.description, amount: clean.amount, currency: getSettings_().currency,
      notes: clean.notes, created_at: new Date() };
    appendRows_('EXPENSES', [row]);
    return row;
  });
  try { rebuildReports_(); } catch (e) { /* non-fatal */ }
  audit_('addExpense', 'EXPENSE', exp.expense_id, 'OK', exp.category + ' ' + exp.amount, 'admin');
  return { expense: expenseView_(exp) };
}

function apiUpdateExpense(payload) {
  var id = String(payload.expense_id || (payload.expense && payload.expense.expense_id) || '').trim();
  var clean = cleanExpense_(payload.expense || payload);
  var row = withLock_(function () {
    invalidate_();
    var r = readTable_('EXPENSES').filter(function (x) { return String(x.expense_id) === id; })[0];
    if (!r) throw apiError_('NOT_FOUND', 'Expense not found.');
    Object.keys(clean).forEach(function (k) { r[k] = clean[k]; });
    writeRow_('EXPENSES', r);
    return r;
  });
  try { rebuildReports_(); } catch (e) { /* non-fatal */ }
  audit_('updateExpense', 'EXPENSE', id, 'OK', row.category + ' ' + row.amount, 'admin');
  return { expense: expenseView_(row) };
}

function apiGetExpenses(payload) {
  var range = parseRange_(payload);
  var list = readTable_('EXPENSES').filter(function (e) {
    return !(range.from || range.to) || inRange_(dateKey_(e.expense_date), range);
  }).map(expenseView_).sort(function (a, b) {
    return a.expense_date < b.expense_date ? 1 : (a.expense_date > b.expense_date ? -1 : (a.expense_id < b.expense_id ? 1 : -1));
  });
  return { expenses: list, categories: EXPENSE_CATEGORIES, total: round2_(list.reduce(function (s, e) { return s + e.amount; }, 0)) };
}

/* ==========================================================================
 * 9. PDF FINANCIAL REPORTS → Google Drive
 * ========================================================================== */

function escHtml_(s) {
  return String(s === null || s === undefined ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function money_(n) {
  var v = Math.round(num_(n));
  var neg = v < 0;
  var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '−' : '') + s + ' ֏';
}

function getReportFolder_() {
  var settings = getSettings_();
  if (settings.report_folder_id) {
    try { return DriveApp.getFolderById(settings.report_folder_id); } catch (e) { /* recreate below */ }
  }
  var it = DriveApp.getFoldersByName('Coffee Lab Reports');
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder('Coffee Lab Reports');
  setSetting_('report_folder_id', folder.getId());
  return folder;
}

var PDF_LABELS = {
  en: {
    title: 'Financial Report', period: 'Reporting period', allTime: 'All time', summary: 'Summary',
    revenue: 'Revenue (net sales)', grossSales: 'Gross sales', discounts: 'Discounts', cogs: 'Cost of goods sold (COGS)',
    grossProfit: 'Gross profit', grossMargin: 'Gross margin', delivery: 'Delivery income', opex: 'Operating expenses',
    netProfit: 'Net profit', netMargin: 'Net margin', orders: 'Orders', units: 'Units sold', aov: 'Average order value',
    sales: 'Sales analysis', product: 'Product', qty: 'Qty', profit: 'Profit', margin: 'Margin',
    category: 'Category', inventory: 'Inventory', invValue: 'Inventory value', skus: 'SKUs', stock: 'Stock',
    reorder: 'Reorder level', lowStock: 'Low-stock & out-of-stock products', none: 'No records in this period',
    purchases: 'Purchases', supplier: 'Supplier', purchaseCost: 'Purchase cost', count: 'Records', expenses: 'Operating expenses',
    amount: 'Amount', generated: 'Generated', byCategory: 'Sales by category', monthly: 'Monthly overview', month: 'Month',
    status: 'Status', out: 'Out of stock', low: 'Low stock',
    exp: { RENT: 'Rent', SALARIES: 'Salaries', MARKETING: 'Marketing', PACKAGING: 'Packaging', DELIVERY: 'Delivery',
      UTILITIES: 'Utilities', SOFTWARE: 'Software', SUPPLIES: 'Supplies', OTHER: 'Other' }
  },
  hy: {
    title: 'Ֆինանսական հաշվետվություն', period: 'Հաշվետու ժամանակահատված', allTime: 'Ամբողջ ժամանակահատված', summary: 'Ամփոփում',
    revenue: 'Եկամուտ (զուտ վաճառք)', grossSales: 'Համախառն վաճառք', discounts: 'Զեղչեր', cogs: 'Վաճառված ապրանքի ինքնարժեք',
    grossProfit: 'Համախառն շահույթ', grossMargin: 'Համախառն մարժա', delivery: 'Առաքման եկամուտ', opex: 'Գործառնական ծախսեր',
    netProfit: 'Զուտ շահույթ', netMargin: 'Զուտ մարժա', orders: 'Պատվերներ', units: 'Վաճառված միավորներ', aov: 'Պատվերի միջին արժեք',
    sales: 'Վաճառքի վերլուծություն', product: 'Ապրանք', qty: 'Քանակ', profit: 'Շահույթ', margin: 'Մարժա',
    category: 'Կատեգորիա', inventory: 'Պահեստ', invValue: 'Պահեստի արժեք', skus: 'SKU', stock: 'Մնացորդ',
    reorder: 'Վերապատվերի շեմ', lowStock: 'Սակավ և սպառված ապրանքներ', none: 'Այս ժամանակահատվածում գրառումներ չկան',
    purchases: 'Գնումներ', supplier: 'Մատակարար', purchaseCost: 'Գնման արժեք', count: 'Գրառումներ', expenses: 'Գործառնական ծախսեր',
    amount: 'Գումար', generated: 'Ստեղծված', byCategory: 'Վաճառքն ըստ կատեգորիաների', monthly: 'Ամսական ամփոփում', month: 'Ամիս',
    status: 'Կարգավիճակ', out: 'Սպառված', low: 'Սակավ',
    exp: { RENT: 'Վարձակալություն', SALARIES: 'Աշխատավարձ', MARKETING: 'Մարքեթինգ', PACKAGING: 'Փաթեթավորում', DELIVERY: 'Առաքում',
      UTILITIES: 'Կոմունալ', SOFTWARE: 'Ծրագրեր', SUPPLIES: 'Պարագաներ', OTHER: 'Այլ' }
  }
};

function buildReportHtml_(f, lang) {
  var L = PDF_LABELS[lang] || PDF_LABELS.en;
  var name = function (x) { return lang === 'hy' ? (x.name_hy || x.name_en) : (x.name_en || x.name_hy); };
  var s = f.summary;
  var period = f.range.all_time ? L.allTime + ' (' + f.range.from + ' — ' + f.range.to + ')' : f.range.from + ' — ' + f.range.to;
  var rows = function (list, cols) {
    if (!list.length) return '<tr><td colspan="' + cols + '" class="muted">' + L.none + '</td></tr>';
    return list.join('');
  };
  var kpi = function (label, value, strong) {
    return '<tr' + (strong ? ' class="strong"' : '') + '><td>' + escHtml_(label) + '</td><td class="r">' + value + '</td></tr>';
  };

  var html = [];
  html.push('<html><head><meta charset="utf-8"><style>',
    'body{font-family:Arial,"Noto Sans Armenian",sans-serif;color:#2b1d14;font-size:10.5pt;margin:28px 34px;}',
    '.brand{border-bottom:3px solid #2b1d14;padding-bottom:10px;margin-bottom:14px;}',
    '.brand h1{margin:0;font-size:24pt;letter-spacing:-0.5px;color:#2b1d14;}',
    '.brand h2{margin:2px 0 0;font-size:13pt;color:#8a5a3b;font-weight:normal;}',
    '.brand p{margin:4px 0 0;font-size:9pt;color:#6b5546;}',
    'h3{font-size:12.5pt;margin:20px 0 6px;color:#2b1d14;border-left:5px solid #c58b4e;padding-left:8px;}',
    'table{width:100%;border-collapse:collapse;margin-top:4px;}',
    'th{background:#2b1d14;color:#f7efe4;text-align:left;font-size:9pt;padding:5px 6px;}',
    'td{border-bottom:1px solid #e6d8c6;padding:4px 6px;font-size:9.5pt;}', 'td.r{white-space:nowrap;}',
    'td.r,th.r{text-align:right;}', 'tr.strong td{font-weight:bold;background:#f5ebdd;}',
    '.muted{color:#8c7a6b;font-style:italic;}', '.neg{color:#a23b2a;}',
    '.grid{width:100%;} .grid td{border:none;vertical-align:top;padding:0 6px 0 0;width:50%;}',
    '.foot{margin-top:26px;border-top:1px solid #c9b59d;padding-top:8px;font-size:8.5pt;color:#6b5546;}',
    '</style></head><body>');

  html.push('<div class="brand"><h1>Coffee Lab</h1><h2>', escHtml_(L.title), '</h2>',
    '<p>Prepared by ', APP.DEVELOPER, ' · ', escHtml_(L.period), ': <b>', escHtml_(period), '</b> · ',
    escHtml_(L.generated), ': ', escHtml_(f.generated_at.replace('T', ' ').substring(0, 16)), '</p></div>');

  // Summary — two side-by-side tables
  html.push('<h3>', L.summary, '</h3><table class="grid"><tr><td><table>',
    kpi(L.grossSales, money_(s.gross_sales)), kpi(L.discounts, money_(-s.discounts)), kpi(L.revenue, money_(s.revenue), true),
    kpi(L.cogs, money_(-s.cogs)), kpi(L.grossProfit, money_(s.gross_profit), true), kpi(L.grossMargin, s.gross_margin.toFixed(2) + '%'),
    '</table></td><td><table>',
    kpi(L.delivery, money_(s.delivery_income)), kpi(L.opex, money_(-s.operating_expenses)),
    kpi(L.netProfit, '<span class="' + (s.net_profit < 0 ? 'neg' : '') + '">' + money_(s.net_profit) + '</span>', true),
    kpi(L.netMargin, s.net_margin.toFixed(2) + '%'), kpi(L.orders, String(s.orders)), kpi(L.units, String(s.units_sold)),
    kpi(L.aov, money_(s.average_order_value)), '</table></td></tr></table>');

  // Monthly overview
  var activeMonths = f.monthly.filter(function (m) { return m.orders > 0 || m.operating_expenses > 0; });
  if (activeMonths.length) {
    html.push('<h3>', L.monthly, '</h3><table><tr><th>', L.month, '</th><th class="r">', L.orders, '</th><th class="r">', L.revenue,
      '</th><th class="r">', L.cogs, '</th><th class="r">', L.grossProfit, '</th><th class="r">', L.opex, '</th><th class="r">', L.netProfit, '</th></tr>');
    activeMonths.forEach(function (m) {
      html.push('<tr><td>', m.month, '</td><td class="r">', m.orders, '</td><td class="r">', money_(m.revenue), '</td><td class="r">',
        money_(m.cogs), '</td><td class="r">', money_(m.gross_profit), '</td><td class="r">', money_(m.operating_expenses),
        '</td><td class="r">', money_(m.net_profit), '</td></tr>');
    });
    html.push('</table>');
  }

  // Sales by category
  html.push('<h3>', L.byCategory, '</h3><table><tr><th>', L.category, '</th><th class="r">', L.qty, '</th><th class="r">', L.revenue,
    '</th><th class="r">COGS</th><th class="r">', L.profit, '</th><th class="r">', L.margin, '</th></tr>');
  html.push(rows(f.by_category.filter(function (c) { return c.quantity > 0; }).map(function (c) {
    return '<tr><td>' + escHtml_(name(c)) + '</td><td class="r">' + c.quantity + '</td><td class="r">' + money_(c.revenue) +
      '</td><td class="r">' + money_(c.cogs) + '</td><td class="r">' + money_(c.profit) + '</td><td class="r">' + c.margin.toFixed(1) + '%</td></tr>';
  }), 6), '</table>');

  // Product sales analysis
  html.push('<h3>', L.sales, '</h3><table><tr><th>', L.product, '</th><th class="r">', L.qty, '</th><th class="r">', L.revenue,
    '</th><th class="r">COGS</th><th class="r">', L.profit, '</th><th class="r">', L.margin, '</th></tr>');
  html.push(rows(f.product_sales.map(function (p) {
    return '<tr><td>' + escHtml_(name(p)) + ' <span class="muted">' + escHtml_(p.sku) + '</span></td><td class="r">' + p.quantity +
      '</td><td class="r">' + money_(p.revenue) + '</td><td class="r">' + money_(p.cogs) + '</td><td class="r">' + money_(p.profit) +
      '</td><td class="r">' + p.margin.toFixed(1) + '%</td></tr>';
  }), 6), '</table>');

  // Inventory
  html.push('<h3>', L.inventory, ' — ', L.invValue, ': ', money_(s.inventory_value), '</h3><table><tr><th>', L.category,
    '</th><th class="r">', L.skus, '</th><th class="r">', L.stock, '</th><th class="r">', L.invValue, '</th></tr>');
  f.inventory_by_category.forEach(function (c) {
    html.push('<tr><td>', escHtml_(name(c)), '</td><td class="r">', c.skus, '</td><td class="r">', c.units, '</td><td class="r">', money_(c.value), '</td></tr>');
  });
  html.push('<tr class="strong"><td>Σ</td><td class="r">', f.inventory_by_category.reduce(function (t, c) { return t + c.skus; }, 0),
    '</td><td class="r">', f.inventory_by_category.reduce(function (t, c) { return t + c.units; }, 0), '</td><td class="r">', money_(s.inventory_value), '</td></tr></table>');
  html.push('<h3>', L.lowStock, '</h3><table><tr><th>', L.product, '</th><th>SKU</th><th class="r">', L.stock, '</th><th class="r">', L.reorder,
    '</th><th>', L.status, '</th><th>', L.supplier, '</th></tr>');
  html.push(rows(f.low_stock.map(function (p) {
    return '<tr><td>' + escHtml_(name(p)) + '</td><td>' + escHtml_(p.sku) + '</td><td class="r">' + p.stock_qty + '</td><td class="r">' +
      p.reorder_level + '</td><td>' + (p.status === 'out_of_stock' ? L.out : L.low) + '</td><td>' + escHtml_(p.supplier) + '</td></tr>';
  }), 6), '</table>');

  // Purchases
  html.push('<h3>', L.purchases, ' — ', money_(s.total_purchases), '</h3><table><tr><th>', L.supplier, '</th><th class="r">', L.count,
    '</th><th class="r">', L.qty, '</th><th class="r">', L.purchaseCost, '</th></tr>');
  html.push(rows(f.purchases_by_supplier.map(function (p) {
    return '<tr><td>' + escHtml_(p.supplier) + '</td><td class="r">' + p.purchases + '</td><td class="r">' + p.quantity +
      '</td><td class="r">' + money_(p.total_cost) + '</td></tr>';
  }), 4), '</table>');

  // Expenses
  html.push('<h3>', L.expenses, ' — ', money_(s.operating_expenses), '</h3><table><tr><th>', L.category, '</th><th class="r">', L.amount, '</th></tr>');
  html.push(rows(f.expenses_by_category.map(function (e) {
    return '<tr><td>' + escHtml_(L.exp[e.category] || e.category) + '</td><td class="r">' + money_(e.amount) + '</td></tr>';
  }), 2), '</table>');

  html.push('<div class="foot">Academic demonstration — no real payment processing · Coffee Lab · Prepared by ', APP.DEVELOPER,
    ' · All amounts in AMD (֏). Revenue is net of discounts; COGS uses the unit cost recorded at the time of each sale.</div>');
  html.push('</body></html>');
  return html.join('');
}

function apiGenerateReportPdf(payload) {
  var lang = payload.lang === 'hy' ? 'hy' : 'en';
  var f = computeFinancials_(parseRange_(payload));
  var html = buildReportHtml_(f, lang);
  var fileName = 'Coffee Lab Financial Report ' + f.range.from + ' to ' + f.range.to + ' (' +
    Utilities.formatDate(new Date(), tz_(), 'yyyyMMdd-HHmmss') + ').pdf';
  var file;
  try {
    var pdf = Utilities.newBlob(html, 'text/html', 'report.html').getAs('application/pdf').setName(fileName);
    file = getReportFolder_().createFile(pdf);
  } catch (e) {
    audit_('generateReportPdf', 'REPORT', '', 'ERROR', String(e && e.message || e), 'admin');
    throw apiError_('PDF_FAILED', 'Could not generate the PDF report.');
  }
  var shared = true;
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { shared = false; }
  audit_('generateReportPdf', 'REPORT', file.getId(), 'OK', fileName, 'admin');
  return {
    file_id: file.getId(),
    name: fileName,
    url: file.getUrl(),
    download_url: 'https://drive.google.com/uc?export=download&id=' + file.getId(),
    shared_publicly: shared,
    range: f.range,
    summary: f.summary
  };
}

/* ==========================================================================
 * 11. API ROUTER — doGet / doPost
 *     Request (POST, Content-Type: text/plain): {"action":"getProducts","payload":{...}}
 *     Request (GET):  ?action=getProducts  or  ?action=getOrder&payload={"order_id":"..."}
 *     Response: {success, data, error, timestamp}
 * ========================================================================== */

function routes_() {
  return {
    // Public storefront actions
    health: { fn: function () { return { status: 'ok', store: APP.NAME, version: APP.VERSION, developer: APP.DEVELOPER }; } },
    getProducts: { fn: apiGetProducts },
    getProduct: { fn: apiGetProduct },
    getCategories: { fn: apiGetCategories },
    createOrder: { fn: apiCreateOrder, write: true },
    getOrder: { fn: apiGetOrder },
    // Admin actions (require admin_pin)
    verifyAdmin: { fn: function () { return { ok: true, settings: publicSettings_(getSettings_()) }; }, admin: true },
    getAdminProducts: { fn: apiAdminProducts, admin: true },
    getOrders: { fn: apiGetOrders, admin: true },
    updateOrderStatus: { fn: apiUpdateOrderStatus, admin: true, write: true },
    addPurchase: { fn: apiAddPurchase, admin: true, write: true },
    getPurchases: { fn: apiGetPurchases, admin: true },
    addExpense: { fn: apiAddExpense, admin: true, write: true },
    updateExpense: { fn: apiUpdateExpense, admin: true, write: true },
    getExpenses: { fn: apiGetExpenses, admin: true },
    getInventory: { fn: apiGetInventory, admin: true },
    getDashboard: { fn: apiGetDashboard, admin: true },
    getFinancialReport: { fn: apiGetFinancialReport, admin: true },
    getReportTables: { fn: apiGetReportTables, admin: true },
    generateReportPdf: { fn: apiGenerateReportPdf, admin: true, write: true },
    createProduct: { fn: apiCreateProduct, admin: true, write: true },
    updateProduct: { fn: apiUpdateProduct, admin: true, write: true },
    rebuildReports: { fn: apiRebuildReports, admin: true, write: true }
  };
}

/** Pure dispatcher (also used by tests). Returns the response envelope object. */
function handleAction_(action, payload, source) {
  TABLE_CACHE_ = {};
  var envelope = { success: false, data: null, error: null, timestamp: new Date().toISOString() };
  try {
    var route = routes_()[action];
    if (!route) throw apiError_('UNKNOWN_ACTION', 'Unknown action: ' + String(action).substring(0, 40));
    payload = payload && typeof payload === 'object' ? payload : {};
    if (route.admin) requireAdmin_(payload);
    envelope.data = route.fn(payload);
    envelope.success = true;
  } catch (err) {
    if (err && err.isApi) {
      envelope.error = { code: err.code, message: err.message, details: err.details || null };
      if (err.code !== 'OUT_OF_STOCK' && err.code !== 'VALIDATION_ERROR' && err.code !== 'ORDER_NOT_FOUND') {
        audit_(action, 'API', '', 'REJECTED', err.code + ': ' + err.message, source);
      }
    } else {
      // Never expose raw Apps Script errors to clients — log them instead.
      audit_(action, 'API', '', 'ERROR', String(err && err.stack || err), source);
      envelope.error = { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server. Please try again.' };
    }
  }
  return envelope;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action) return jsonOut_(handleAction_('health', {}, 'get'));
  var payload = {};
  if (p.payload) {
    try { payload = JSON.parse(p.payload); } catch (err) { return jsonOut_({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Invalid payload JSON' }, timestamp: new Date().toISOString() }); }
  } else {
    for (var k in p) if (k !== 'action') payload[k] = p[k];
  }
  // Writes are only accepted via POST.
  var route = routes_()[p.action];
  if (route && route.write) return jsonOut_({ success: false, data: null, error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST for this action' }, timestamp: new Date().toISOString() });
  return jsonOut_(handleAction_(p.action, payload, 'get'));
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return jsonOut_({ success: false, data: null, error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' }, timestamp: new Date().toISOString() });
  }
  return jsonOut_(handleAction_(body.action, body.payload || {}, 'post'));
}

/* ==========================================================================
 * 12. SETUP, SEED DATA & MENU
 * ========================================================================== */

var SUPPLIERS = {
  A: 'Ararat Green Coffee Imports',
  H: 'Highland Specialty Traders',
  R: 'Yerevan Roastworks',
  S: 'Sevan Trade House',
  D: 'Sweet Drop Syrups LLC',
  B: 'Barista Supply AM',
  C: 'Caucasus Homeware'
};

/**
 * 75 demo products. Columns:
 * [sku, category, name_en, name_hy, origin, roast_level, grind_type, weight_g, unit,
 *  sale_price, unit_cost, target_stock, reorder_level, supplier_code, description_en, description_hy]
 * target_stock = stock after all seeded transactions (several low / out-of-stock on purpose).
 * Prices are fictional demo values in AMD.
 */
var SEED_PRODUCTS = [
  // ---------------- Coffee Beans (17)
  ['CB-ETH-YIR-250', 'coffee-beans', 'Ethiopia Yirgacheffe Arabica', 'Եթովպիա Իրգաչեֆե Արաբիկա', 'Ethiopia', 'light', 'whole-bean', 250, 'bag', 7200, 4100, 42, 10, 'H',
    'Washed Arabica with jasmine, bergamot and lemon notes; bright and tea-like.', 'Լվացված արաբիկա՝ հասմիկի, բերգամոտի և կիտրոնի նոտաներով, թեթև և թեյանման։'],
  ['CB-ETH-NAT-250', 'coffee-beans', 'Ethiopian Natural Sidamo', 'Եթովպիական Նատուրալ Սիդամո', 'Ethiopia', 'medium-light', 'whole-bean', 250, 'bag', 6900, 4300, 8, 10, 'H',
    'Sun-dried natural process with blueberry, strawberry jam and cocoa sweetness.', 'Արևի տակ չորացված բնական մշակում՝ հապալասի, ելակի ջեմի և կակաոյի քաղցրությամբ։'],
  ['CB-COL-SUP-500', 'coffee-beans', 'Colombia Supremo', 'Կոլումբիա Սուպրեմո', 'Colombia', 'medium', 'whole-bean', 500, 'bag', 11500, 7200, 35, 10, 'A',
    'Large-screen Huila beans with caramel, red apple and a smooth nutty finish.', 'Խոշոր հատիկներ Ուիլայից՝ կարամելի, կարմիր խնձորի և ընկույզային հարթ ավարտով։'],
  ['CB-BRA-SAN-1KG', 'coffee-beans', 'Brazil Santos 1 kg', 'Բրազիլիա Սանտոս 1 կգ', 'Brazil', 'medium', 'whole-bean', 1000, 'bag', 17500, 12400, 28, 8, 'A',
    'Everyday classic with milk chocolate, roasted peanut and low acidity.', 'Ամենօրյա դասական՝ կաթնային շոկոլադի, բոված գետնանուշի և ցածր թթվայնության համով։'],
  ['CB-BRA-CER-500', 'coffee-beans', 'Brazil Cerrado', 'Բրազիլիա Սեռադո', 'Brazil', 'medium-dark', 'whole-bean', 500, 'bag', 9800, 6500, 30, 10, 'A',
    'Full-bodied pulped natural with dark chocolate and hazelnut; great with milk.', 'Թանձր մարմնով սուրճ՝ մուգ շոկոլադի և պնդուկի նոտաներով, հիանալի է կաթի հետ։'],
  ['CB-GUA-ANT-250', 'coffee-beans', 'Guatemala Antigua', 'Գվատեմալա Անտիգուա', 'Guatemala', 'medium', 'whole-bean', 250, 'bag', 6800, 4200, 25, 8, 'A',
    'Volcanic-soil highland coffee with cocoa, spice and orange zest.', 'Հրաբխային հողերում աճած լեռնային սուրճ՝ կակաոյի, համեմունքի և նարնջի կեղևի նոտաներով։'],
  ['CB-KEN-AA-250', 'coffee-beans', 'Kenya AA', 'Քենիա AA', 'Kenya', 'light', 'whole-bean', 250, 'bag', 8400, 4900, 4, 8, 'H',
    'Juicy and complex: blackcurrant, grapefruit and a wine-like acidity.', 'Հյութալի և բազմաշերտ՝ սև հաղարջ, գրեյպֆրուտ և գինու նման թթվայնություն։'],
  ['CB-CRC-TAR-250', 'coffee-beans', 'Costa Rica Tarrazú', 'Կոստա Ռիկա Տարասու', 'Costa Rica', 'medium', 'whole-bean', 250, 'bag', 7600, 4600, 18, 8, 'H',
    'Honey-processed beans with brown sugar, apricot and a clean finish.', 'Մեղրային մշակմամբ հատիկներ՝ շագանակագույն շաքարի, ծիրանի և մաքուր ավարտով։'],
  ['CB-HOU-ESP-1KG', 'coffee-beans', 'House Espresso Blend 1 kg', 'Տան էսպրեսսո խառնուրդ 1 կգ', 'Brazil · Colombia · India', 'dark', 'whole-bean', 1000, 'bag', 16900, 11800, 40, 12, 'R',
    'Our everyday espresso: heavy body, thick crema and notes of cocoa and caramel.', 'Մեր ամենօրյա էսպրեսսոն՝ թանձր մարմին, խիտ կրեմա, կակաոյի և կարամելի նոտաներ։'],
  ['CB-PRM-ESP-1KG', 'coffee-beans', 'Premium Espresso Blend 1 kg', 'Պրեմիում էսպրեսսո խառնուրդ 1 կգ', 'Ethiopia · Brazil · Guatemala', 'medium-dark', 'whole-bean', 1000, 'bag', 23500, 14800, 22, 8, 'R',
    '100% Arabica espresso with sweet berry top notes and a dark-chocolate base.', '100% արաբիկա էսպրեսսո՝ քաղցր հատապտղային նոտաներով և մուգ շոկոլադի հիմքով։'],
  ['CB-IND-ROB-500', 'coffee-beans', 'India Cherry Robusta', 'Հնդկական Չերի Ռոբուստա', 'India', 'dark', 'whole-bean', 500, 'bag', 8700, 6100, 26, 8, 'A',
    'Clean, high-caffeine robusta that adds punch and crema to espresso blends.', 'Մաքուր, բարձր կոֆեինով ռոբուստա, որը էսպրեսսոյին ուժ և կրեմա է հաղորդում։'],
  ['CB-VNM-ROB-1KG', 'coffee-beans', 'Vietnam Robusta 1 kg', 'Վիետնամական Ռոբուստա 1 կգ', 'Vietnam', 'dark', 'whole-bean', 1000, 'bag', 16000, 11900, 0, 6, 'A',
    'Bold and earthy robusta, ideal for phin filters and strong iced coffee.', 'Ուժեղ և հողային համով ռոբուստա՝ իդեալական ֆին ֆիլտրի և սառը սուրճի համար։'],
  ['CB-SUM-MAN-250', 'coffee-beans', 'Sumatra Mandheling', 'Սումատրա Մանդելինգ', 'Indonesia', 'dark', 'whole-bean', 250, 'bag', 7400, 4800, 20, 8, 'A',
    'Wet-hulled Sumatra with cedar, dark cocoa and a syrupy, low-acid body.', 'Սումատրայի սուրճ՝ մայրու, մուգ կակաոյի նոտաներով և օշարակային, ցածր թթվայնությամբ։'],
  ['CB-PER-ORG-500', 'coffee-beans', 'Peru Organic Cajamarca', 'Պերու Օրգանիկ Կախամարկա', 'Peru', 'medium', 'whole-bean', 500, 'bag', 12800, 8100, 16, 6, 'H',
    'Certified organic Arabica with milk chocolate, almond and soft citrus.', 'Սերտիֆիկացված օրգանական արաբիկա՝ կաթնային շոկոլադի, նուշի և մեղմ ցիտրուսի նոտաներով։'],
  ['CB-PAN-GEI-100', 'coffee-beans', 'Panama Geisha Specialty', 'Պանամա Գեյշա սպեշըլթի', 'Panama', 'light', 'whole-bean', 100, 'bag', 18500, 9800, 6, 4, 'H',
    'Rare specialty microlot: jasmine, peach and honey with a silky finish.', 'Հազվագյուտ սպեշըլթի միկրոլոտ՝ հասմիկ, դեղձ և մեղր, մետաքսյա ավարտով։'],
  ['CB-DEC-COL-250', 'coffee-beans', 'Colombia Swiss Water Decaf', 'Կոլումբիա Swiss Water առանց կոֆեինի', 'Colombia', 'medium', 'whole-bean', 250, 'bag', 6500, 4200, 12, 6, 'A',
    'Chemical-free decaffeinated beans that keep caramel and cocoa sweetness.', 'Առանց քիմիկատների կոֆեինազրկված հատիկներ՝ կարամելի և կակաոյի քաղցրությամբ։'],
  ['CB-MOC-JAV-500', 'coffee-beans', 'Mocha Java Blend', 'Մոկա Ջավա խառնուրդ', 'Ethiopia · Indonesia', 'medium-dark', 'whole-bean', 500, 'bag', 12200, 7900, 3, 6, 'R',
    'The oldest blend in coffee history: fruity Ethiopia balanced by earthy Java.', 'Սուրճի պատմության ամենահին խառնուրդը՝ մրգային Եթովպիա և հողային Ջավա։'],

  // ---------------- Ground Coffee (10)
  ['GR-CLS-250', 'ground-coffee', 'Classic Ground Coffee', 'Դասական աղացած սուրճ', 'Brazil · Colombia', 'medium', 'filter', 250, 'bag', 3900, 2600, 60, 15, 'R',
    'Balanced medium roast ground for drip machines and everyday brewing.', 'Հավասարակշռված միջին բովում՝ աղացած կաթիլային մեքենաների և ամենօրյա եփման համար։'],
  ['GR-DRK-250', 'ground-coffee', 'Dark Roast Ground Coffee', 'Մուգ բովված աղացած սուրճ', 'Brazil · India', 'dark', 'universal', 250, 'bag', 4200, 2900, 45, 15, 'R',
    'Intense dark roast with smoky cocoa notes for those who like it strong.', 'Ինտենսիվ մուգ բովում՝ ծխային կակաոյի նոտաներով, ուժեղ սուրճ սիրողների համար։'],
  ['GR-FRP-250', 'ground-coffee', 'French Press Ground Coffee', 'Ֆրանսիական մամլիչի աղացած սուրճ', 'Guatemala · Brazil', 'medium', 'french-press', 250, 'bag', 4800, 3000, 22, 8, 'R',
    'Coarse grind that brews a rich, full cup without sludge.', 'Խոշոր աղացում, որը տալիս է հարուստ և թանձր սուրճ՝ առանց նստվածքի։'],
  ['GR-TRK-200', 'ground-coffee', 'Turkish Ground Coffee', 'Սուրճ ջեզվեի համար', 'Brazil', 'medium', 'turkish', 200, 'bag', 3600, 2300, 70, 20, 'R',
    'Ultra-fine, powder-like grind for traditional cezve coffee with thick foam.', 'Գերնուրբ, փոշենման աղացում՝ ավանդական ջեզվեի սուրճի և թանձր փրփուրի համար։'],
  ['GR-TRK-CRD-200', 'ground-coffee', 'Turkish Coffee with Cardamom', 'Սուրճ հիլով', 'Brazil', 'medium', 'turkish', 200, 'bag', 4100, 2500, 2, 10, 'R',
    'Fine cezve grind blended with aromatic green cardamom.', 'Ջեզվեի նուրբ աղացում՝ խառնված բուրավետ կանաչ հիլի հետ։'],
  ['GR-MOK-250', 'ground-coffee', 'Moka Grind Coffee', 'Մոկա աղացած սուրճ', 'Brazil · Colombia', 'medium-dark', 'moka', 250, 'bag', 4600, 2900, 24, 8, 'R',
    'Fine-medium grind tuned for stovetop moka pots: sweet, bold, no bitterness.', 'Մոկա թեյնիկի համար հարմարեցված աղացում՝ քաղցր, ուժեղ և առանց դառնության։'],
  ['GR-ESP-500', 'ground-coffee', 'Italian Espresso Grind', 'Իտալական էսպրեսսո աղացած', 'Brazil · India', 'dark', 'espresso', 500, 'bag', 8900, 5900, 18, 6, 'R',
    'Fine espresso grind with a classic Italian dark roast profile.', 'Նուրբ էսպրեսսո աղացում՝ դասական իտալական մուգ բովման պրոֆիլով։'],
  ['GR-FLT-1KG', 'ground-coffee', 'Brazil Filter Grind 1 kg', 'Բրազիլիա ֆիլտր աղացած 1 կգ', 'Brazil', 'medium', 'filter', 1000, 'bag', 12800, 8800, 10, 5, 'R',
    'Office-size bag of smooth Brazilian coffee for batch brewers.', 'Գրասենյակային չափի տոպրակ՝ մեղմ բրազիլական սուրճ մեծ ծավալով եփելու համար։'],
  ['GR-ETH-250', 'ground-coffee', 'Ethiopia Pour-Over Grind', 'Եթովպիա փուր-օվեր աղացած', 'Ethiopia', 'light', 'pour-over', 250, 'bag', 6200, 3700, 15, 6, 'H',
    'Medium-fine grind of washed Ethiopian coffee for V60 and drippers.', 'Լվացված եթովպական սուրճի միջին-նուրբ աղացում՝ V60-ի և դրիփերների համար։'],
  ['GR-DEC-250', 'ground-coffee', 'Decaf Ground Coffee', 'Առանց կոֆեինի աղացած սուրճ', 'Colombia', 'medium', 'filter', 250, 'bag', 4900, 3200, 0, 6, 'R',
    'Smooth decaf ground for evening cups without the caffeine.', 'Մեղմ, առանց կոֆեինի աղացած սուրճ՝ երեկոյան բաժակի համար։'],

  // ---------------- Instant & Powder (7)
  ['IN-CLS-100', 'instant-coffee', 'Classic Instant Coffee', 'Դասական լուծվող սուրճ', 'Brazil', '', 'instant', 100, 'jar', 2900, 1900, 80, 20, 'S',
    'Spray-dried instant coffee in a resealable jar — ready in seconds.', 'Լուծվող սուրճ՝ փակվող տարայով, պատրաստ է վայրկյանների ընթացքում։'],
  ['IN-PRM-100', 'instant-coffee', 'Premium Freeze-Dried Instant', 'Պրեմիում սառեցված-չորացված լուծվող սուրճ', 'Colombia', '', 'instant', 100, 'jar', 4700, 2700, 40, 12, 'S',
    'Freeze-dried Arabica granules with a rounder aroma and richer taste.', 'Սառեցնելով չորացված արաբիկայի հատիկներ՝ ավելի հարուստ բույրով և համով։'],
  ['IN-GLD-200', 'instant-coffee', 'Gold Instant Coffee 200 g', 'Գոլդ լուծվող սուրճ 200 գ', 'Brazil · Colombia', '', 'instant', 200, 'jar', 7900, 4900, 20, 8, 'S',
    'Large family jar of smooth golden-roast instant coffee.', 'Ընտանեկան մեծ տարա՝ մեղմ ոսկեգույն բովման լուծվող սուրճով։'],
  ['IN-DEC-100', 'instant-coffee', 'Decaf Instant Coffee', 'Առանց կոֆեինի լուծվող սուրճ', 'Colombia', '', 'instant', 100, 'jar', 4300, 2800, 14, 6, 'S',
    'Freeze-dried decaf with 99.9% of the caffeine removed.', 'Սառեցնելով չորացված սուրճ՝ 99.9%-ով կոֆեինազրկված։'],
  ['IN-3IN1-20', 'instant-coffee', '3-in-1 Coffee Mix (20 sticks)', '3-ը 1-ում սուրճ (20 փաթեթ)', 'Vietnam', '', 'instant', 360, 'box', 2700, 1700, 90, 25, 'S',
    'Coffee, creamer and sugar in single-serve sticks for travel and office.', 'Սուրճ, սերուցք և շաքար մեկանգամյա փաթեթներում՝ ճանապարհի և գրասենյակի համար։'],
  ['IN-ESP-POW-50', 'instant-coffee', 'Espresso Powder for Baking', 'Էսպրեսսո փոշի թխվածքի համար', 'Italy', 'dark', 'powder', 50, 'jar', 3400, 1800, 9, 5, 'S',
    'Fine instant espresso powder that deepens chocolate cakes and tiramisu.', 'Նուրբ էսպրեսսո փոշի, որը խորացնում է շոկոլադե տորթերի և տիրամիսուի համը։'],
  ['IN-SPC-COL-10', 'instant-coffee', 'Specialty Instant Colombia (10 sachets)', 'Սպեշըլթի լուծվող Կոլումբիա (10 փաթեթ)', 'Colombia', 'medium-light', 'instant', 30, 'box', 5900, 3200, 5, 6, 'H',
    'Specialty-grade coffee brewed and freeze-dried — café taste from a sachet.', 'Սպեշըլթի դասի սուրճ՝ եփված և սառեցված-չորացված, սրճարանային համ փաթեթից։'],

  // ---------------- Syrups & Add-ons (10)
  ['SY-VAN-700', 'syrups-addons', 'Vanilla Syrup 700 ml', 'Վանիլային օշարակ 700 մլ', 'France', '', '', 700, 'bottle', 3900, 2100, 34, 10, 'D',
    'Classic vanilla syrup for lattes, cappuccinos and cold brew.', 'Դասական վանիլային օշարակ լատեի, կապուչինոյի և սառը սուրճի համար։'],
  ['SY-CAR-700', 'syrups-addons', 'Caramel Syrup 700 ml', 'Կարամելային օշարակ 700 մլ', 'France', '', '', 700, 'bottle', 3900, 2000, 28, 10, 'D',
    'Buttery caramel syrup — the base for a perfect caramel macchiato.', 'Կարագային կարամելի օշարակ՝ կատարյալ կարամել մակիատոյի հիմքը։'],
  ['SY-HAZ-700', 'syrups-addons', 'Hazelnut Syrup 700 ml', 'Պնդուկի օշարակ 700 մլ', 'France', '', '', 700, 'bottle', 3900, 2200, 19, 10, 'D',
    'Toasted hazelnut flavour that pairs beautifully with espresso and milk.', 'Բոված պնդուկի համ, որը հիանալի համադրվում է էսպրեսսոյի և կաթի հետ։'],
  ['SY-CHO-700', 'syrups-addons', 'Chocolate Syrup 700 ml', 'Շոկոլադե օշարակ 700 մլ', 'Belgium', '', '', 700, 'bottle', 4200, 2300, 21, 8, 'D',
    'Rich cocoa syrup for mochas, hot chocolate and dessert drizzles.', 'Հարուստ կակաոյի օշարակ մոկայի, տաք շոկոլադի և աղանդերների համար։'],
  ['SY-CIN-700', 'syrups-addons', 'Cinnamon Syrup 700 ml', 'Դարչինի օշարակ 700 մլ', 'France', '', '', 700, 'bottle', 4100, 2400, 12, 6, 'D',
    'Warm cinnamon spice syrup for autumn lattes and cezve coffee.', 'Տաք դարչինի օշարակ աշնանային լատեների և ջեզվեի սուրճի համար։'],
  ['SY-SCA-700', 'syrups-addons', 'Salted Caramel Syrup 700 ml', 'Աղի կարամելի օշարակ 700 մլ', 'France', '', '', 700, 'bottle', 4400, 2300, 9, 6, 'D',
    'Caramel with a pinch of sea salt for a sweet-savory twist.', 'Կարամել՝ ծովային աղի պտղունցով, քաղցր-աղի համադրության համար։'],
  ['AD-BRS-500', 'syrups-addons', 'Brown Sugar 500 g', 'Շագանակագույն շաքար 500 գ', 'Mauritius', '', '', 500, 'pack', 2100, 1250, 50, 15, 'S',
    'Soft brown sugar with molasses notes that complements dark roasts.', 'Փափուկ շագանակագույն շաքար՝ մելասի նոտաներով, համադրվում է մուգ բովման հետ։'],
  ['AD-CAN-100', 'syrups-addons', 'Cane Sugar Sticks (100 pcs)', 'Եղեգնաշաքարի փաթեթիկներ (100 հատ)', 'Brazil', '', '', 500, 'box', 2600, 1400, 44, 12, 'S',
    'Individually wrapped 5 g cane sugar sticks for home, office and cafés.', 'Առանձին փաթեթավորված 5 գ եղեգնաշաքար՝ տան, գրասենյակի և սրճարանի համար։'],
  ['AD-CRM-400', 'syrups-addons', 'Coffee Creamer 400 g', 'Սուրճի սերուցք 400 գ', 'Netherlands', '', '', 400, 'pack', 2900, 1900, 31, 10, 'S',
    'Powdered creamer that makes coffee silky and smooth without refrigeration.', 'Փոշի սերուցք, որը սուրճը դարձնում է մետաքսյա՝ առանց սառնարանի։'],
  ['AD-CHP-250', 'syrups-addons', 'Chocolate Powder 250 g', 'Շոկոլադի փոշի 250 գ', 'Belgium', '', '', 250, 'pack', 3300, 2000, 3, 8, 'S',
    'Belgian cocoa powder for mochas and dusting cappuccino foam.', 'Բելգիական կակաոյի փոշի մոկայի և կապուչինոյի փրփուրը զարդարելու համար։'],

  // ---------------- Filters & Consumables (5)
  ['FL-CON-02-100', 'filters-consumables', 'Paper Cone Filters #02 (100 pcs)', 'Թղթե կոնաձև ֆիլտրեր #02 (100 հատ)', 'Japan', '', '', 0, 'pack', 2400, 1450, 55, 15, 'B',
    'Oxygen-bleached cone filters for 02-size pour-over drippers.', 'Թթվածնով սպիտակեցված կոնաձև ֆիլտրեր 02 չափսի դրիփերների համար։'],
  ['FL-BSK-100', 'filters-consumables', 'Basket Paper Filters (100 pcs)', 'Զամբյուղաձև թղթե ֆիլտրեր (100 հատ)', 'Germany', '', '', 0, 'pack', 1900, 1200, 40, 12, 'B',
    'Flat-bottom filters for drip coffee machines and batch brewers.', 'Հարթ հատակով ֆիլտրեր կաթիլային սուրճի մեքենաների համար։'],
  ['FL-STL-RE', 'filters-consumables', 'Stainless Steel Reusable Filter', 'Չժանգոտվող պողպատե բազմակի ֆիլտր', 'Taiwan', '', '', 0, 'pcs', 5900, 3500, 14, 5, 'B',
    'Double-mesh steel cone that replaces paper filters for years.', 'Կրկնակի ցանցով պողպատե կոն, որը տարիներով փոխարինում է թղթե ֆիլտրերին։'],
  ['FL-CLT-RE', 'filters-consumables', 'Reusable Cloth Filter', 'Բազմակի կտորե ֆիլտր', 'Japan', '', '', 0, 'pcs', 3900, 2300, 10, 4, 'B',
    'Cotton flannel filter for an exceptionally sweet, full-bodied cup.', 'Բամբակյա ֆլանելե ֆիլտր՝ բացառիկ քաղցր և թանձր սուրճի համար։'],
  ['FL-CLN-TAB-50', 'filters-consumables', 'Espresso Machine Cleaning Tablets (50 pcs)', 'Էսպրեսսո մեքենայի մաքրող հաբեր (50 հատ)', 'Germany', '', '', 0, 'box', 4900, 2900, 0, 5, 'B',
    'Backflush tablets that remove coffee oils from group heads.', 'Հաբեր, որոնք հեռացնում են սուրճի յուղերը մեքենայի գլխիկից։'],

  // ---------------- Brewing Equipment (12)
  ['EQ-FRP-1000', 'brewing-equipment', 'French Press 1 L', 'Ֆրանսիական մամլիչ 1 լ', '', '', '', 0, 'pcs', 12900, 8200, 15, 5, 'B',
    'Borosilicate glass and steel press for 8 cups of rich immersion coffee.', 'Բորոսիլիկատային ապակուց և պողպատից մամլիչ՝ 8 բաժակ հարուստ սուրճի համար։'],
  ['EQ-FRP-350', 'brewing-equipment', 'French Press 350 ml', 'Ֆրանսիական մամլիչ 350 մլ', '', '', '', 0, 'pcs', 7900, 5200, 18, 5, 'B',
    'Compact single-serve press for one generous mug.', 'Կոմպակտ մամլիչ մեկ մեծ բաժակի համար։'],
  ['EQ-MOK-6', 'brewing-equipment', 'Moka Pot (6 cups)', 'Մոկա թեյնիկ (6 բաժակ)', 'Italy', '', '', 0, 'pcs', 13500, 9100, 12, 4, 'B',
    'Classic aluminium stovetop espresso maker with octagonal body.', 'Դասական ալյումինե գազօջախի էսպրեսսո թեյնիկ՝ ութանկյուն ձևով։'],
  ['EQ-MOK-IND-3', 'brewing-equipment', 'Induction Moka Pot (3 cups)', 'Ինդուկցիոն մոկա թեյնիկ (3 բաժակ)', 'Italy', '', '', 0, 'pcs', 17900, 11900, 8, 4, 'B',
    'Stainless steel moka pot that works on induction and gas hobs.', 'Չժանգոտվող պողպատե մոկա, որն աշխատում է ինդուկցիոն և գազօջախի վրա։'],
  ['EQ-DRP-CER', 'brewing-equipment', 'Ceramic Pour-Over Dripper', 'Կերամիկական փուր-օվեր դրիփեր', 'Japan', '', '', 0, 'pcs', 9800, 5600, 16, 5, 'B',
    'Spiral-ribbed ceramic dripper for clean, aromatic filter coffee.', 'Պարուրաձև ակոսներով կերամիկական դրիփեր՝ մաքուր և բուրավետ սուրճի համար։'],
  ['EQ-SRV-600', 'brewing-equipment', 'Glass Coffee Server 600 ml', 'Ապակե սուրճի սերվեր 600 մլ', '', '', '', 0, 'pcs', 8400, 5100, 13, 5, 'B',
    'Heat-resistant glass server with volume marks for pour-over.', 'Ջերմակայուն ապակե սերվեր՝ ծավալի նշումներով փուր-օվերի համար։'],
  ['EQ-SCL-TMR', 'brewing-equipment', 'Digital Coffee Scale with Timer', 'Թվային սուրճի կշեռք ժամաչափով', '', '', '', 0, 'pcs', 18900, 12600, 9, 4, 'B',
    '0.1 g precision scale with built-in timer for repeatable brews.', '0.1 գ ճշգրտությամբ կշեռք՝ ներկառուցված ժամաչափով։'],
  ['EQ-GRD-ELC', 'brewing-equipment', 'Electric Burr Grinder', 'Էլեկտրական ջաղացաքարային սրճաղաց', '', '', '', 0, 'pcs', 64000, 46500, 4, 3, 'B',
    '40 grind settings from espresso to French press with steel conical burrs.', '40 աղացման կարգավորում՝ էսպրեսսոյից մինչև ֆրանսիական մամլիչ, պողպատե կոնաձև ջաղացաքարերով։'],
  ['EQ-GRD-HND', 'brewing-equipment', 'Hand Grinder (Ceramic Burr)', 'Ձեռքի սրճաղաց (կերամիկական ջաղացաքար)', '', '', '', 0, 'pcs', 22500, 14200, 11, 4, 'B',
    'Portable manual grinder with adjustable ceramic burrs — quiet and precise.', 'Շարժական ձեռքի սրճաղաց՝ կարգավորվող կերամիկական ջաղացաքարերով, անաղմուկ և ճշգրիտ։'],
  ['EQ-KTL-GSN', 'brewing-equipment', 'Gooseneck Kettle 1 L', 'Սագավիզ թեյնիկ 1 լ', '', '', '', 0, 'pcs', 24900, 16800, 7, 3, 'B',
    'Precision-pour gooseneck kettle with thermometer for pour-over.', 'Ճշգրիտ լցման սագավիզ թեյնիկ՝ ջերմաչափով փուր-օվերի համար։'],
  ['EQ-CEZ-CPR', 'brewing-equipment', 'Copper Cezve 300 ml', 'Պղնձե ջեզվե 300 մլ', 'Armenia', '', '', 0, 'pcs', 8900, 5300, 20, 6, 'C',
    'Hand-hammered copper cezve with a wooden handle for 3–4 cups.', 'Ձեռքով կռած պղնձե ջեզվե փայտե բռնակով՝ 3–4 բաժակի համար։'],
  ['EQ-FRT-ELC', 'brewing-equipment', 'Electric Milk Frother', 'Էլեկտրական կաթի փրփրիչ', '', '', '', 0, 'pcs', 15900, 10700, 2, 4, 'B',
    'Heats and froths milk for lattes and cappuccinos at the push of a button.', 'Տաքացնում և փրփրեցնում է կաթը լատեի և կապուչինոյի համար մեկ սեղմումով։'],

  // ---------------- Accessories & Storage (14)
  ['AC-CNT-VAC', 'accessories-storage', 'Airtight Coffee Container 1.2 L', 'Հերմետիկ սուրճի տարա 1.2 լ', '', '', '', 0, 'pcs', 11900, 6600, 17, 5, 'C',
    'Vacuum-seal canister with date dial that keeps beans fresh for weeks.', 'Վակուումային փակվող տարա ամսաթվի ցուցիչով, որը շաբաթներով պահում է թարմությունը։'],
  ['AC-JAR-GLS', 'accessories-storage', 'Glass Coffee Bean Storage Jar', 'Ապակե տարա սուրճի հատիկների համար', '', '', '', 0, 'pcs', 5400, 2700, 21, 6, 'C',
    'Amber glass jar with bamboo lid and silicone seal for 250 g of beans.', 'Սաթագույն ապակե տարա բամբուկե կափարիչով՝ 250 գ հատիկի համար։'],
  ['AC-PIT-600', 'accessories-storage', 'Milk Frothing Pitcher 600 ml', 'Կաթի փրփրեցման սափոր 600 մլ', '', '', '', 0, 'pcs', 6900, 3900, 14, 5, 'B',
    'Stainless steel pitcher with a sharp spout for latte art.', 'Չժանգոտվող պողպատե սափոր՝ սուր ծորակով լատե արտի համար։'],
  ['AC-SPN-MSR', 'accessories-storage', 'Coffee Measuring Spoon', 'Սուրճի չափիչ գդալ', '', '', '', 0, 'pcs', 2900, 1300, 38, 10, 'C',
    'Exact 10 g scoop with a long handle that clips onto bags.', 'Ճշգրիտ 10 գ չափիչ գդալ՝ երկար բռնակով, որը ամրանում է տոպրակին։'],
  ['AC-CUP-RE', 'accessories-storage', 'Reusable Coffee Cup 350 ml', 'Բազմակի սուրճի բաժակ 350 մլ', '', '', '', 0, 'pcs', 5500, 2800, 30, 8, 'C',
    'Leak-proof reusable cup to replace disposable takeaway cups.', 'Չթափվող բազմակի բաժակ՝ մեկանգամյա բաժակների փոխարեն։'],
  ['AC-CUP-CER', 'accessories-storage', 'Ceramic Coffee Cup 250 ml', 'Կերամիկական սուրճի բաժակ 250 մլ', 'Armenia', '', '', 0, 'pcs', 4900, 2300, 26, 8, 'C',
    'Thick-walled stoneware cup that keeps flat whites warm.', 'Հաստ պատերով կերամիկական բաժակ, որը երկար պահում է ջերմությունը։'],
  ['AC-MUG-TRV', 'accessories-storage', 'Travel Mug 450 ml', 'Ճամփորդական բաժակ 450 մլ', '', '', '', 0, 'pcs', 9900, 5600, 19, 6, 'C',
    'Double-wall vacuum mug that keeps coffee hot for 6 hours.', 'Կրկնակի պատերով վակուումային բաժակ, որը սուրճը տաք է պահում 6 ժամ։'],
  ['AC-BTL-THM', 'accessories-storage', 'Thermal Coffee Bottle 750 ml', 'Ջերմապահ սուրճի շիշ 750 մլ', '', '', '', 0, 'pcs', 14500, 8900, 9, 4, 'C',
    'Large thermos for road trips and hikes, hot for 12 hours.', 'Մեծ ջերմոս ճանապարհորդությունների և արշավների համար՝ տաք 12 ժամ։'],
  ['AC-BRS-CLN', 'accessories-storage', 'Grinder Cleaning Brush', 'Սրճաղացի մաքրման խոզանակ', '', '', '', 0, 'pcs', 2400, 1100, 33, 8, 'B',
    'Soft natural-bristle brush for grinders and espresso machines.', 'Բնական փափուկ մազիկներով խոզանակ սրճաղացների և մեքենաների համար։'],
  ['AC-TMP-58', 'accessories-storage', 'Coffee Tamper 58 mm', 'Սուրճի թամպեր 58 մմ', '', '', '', 0, 'pcs', 12900, 7300, 8, 4, 'B',
    'Calibrated spring tamper for consistent espresso pressure.', 'Կալիբրացված զսպանակով թամպեր՝ էսպրեսսոյի կայուն ճնշման համար։'],
  ['AC-WDT-TL', 'accessories-storage', 'Espresso Distribution Tool', 'Էսպրեսսոյի բաշխման գործիք', '', '', '', 0, 'pcs', 15500, 9400, 6, 3, 'B',
    'Adjustable leveler that spreads grounds evenly before tamping.', 'Կարգավորվող գործիք, որը հավասարաչափ բաշխում է աղացած սուրճը թամպինգից առաջ։'],
  ['AC-KNK-BOX', 'accessories-storage', 'Knock Box', 'Նոկ-բոքս սուրճի մնացորդների համար', '', '', '', 0, 'pcs', 9400, 5800, 10, 4, 'B',
    'Rubber-bar knock box for spent espresso pucks.', 'Ռետինե ձողով տարա օգտագործված էսպրեսսոյի համար։'],
  ['AC-SCP-WD', 'accessories-storage', 'Wooden Coffee Scoop', 'Փայտե սուրճի գդալ', 'Armenia', '', '', 0, 'pcs', 3200, 1400, 24, 6, 'C',
    'Hand-carved walnut scoop — a small gift for coffee lovers.', 'Ձեռքով փորագրված ընկուզենու գդալ՝ փոքրիկ նվեր սուրճասերներին։'],
  ['AC-STD-WD', 'accessories-storage', 'Pour-Over Brewing Stand', 'Փուր-օվերի կանգնակ', '', '', '', 0, 'pcs', 13900, 8200, 5, 3, 'C',
    'Walnut and steel stand that holds a dripper above a cup or scale.', 'Ընկուզենուց և պողպատից կանգնակ, որը դրիփերը պահում է բաժակի կամ կշեռքի վերևում։']
];

var SEED_CUSTOMERS = [
  ['Anna Petrosyan', 'anna.petrosyan@example.com', '+374 91 204 118', '', '12 Abovyan St, Yerevan', 40.1841, 44.5158],
  ['Davit Hakobyan', 'davit.hakobyan@example.com', '+374 93 551 702', 'Hakobyan Design Studio', '5 Tumanyan St, Yerevan', 40.1852, 44.5119],
  ['Mariam Sargsyan', 'mariam.sargsyan@example.com', '+374 77 318 640', '', '41 Mashtots Ave, Yerevan', 40.1866, 44.5088],
  ['Aram Grigoryan', 'aram.grigoryan@example.com', '+374 94 772 015', 'Grigoryan & Partners', '18 Komitas Ave, Yerevan', 40.2051, 44.5207],
  ['Lilit Harutyunyan', 'lilit.h@example.com', '+374 98 106 334', '', '24 Baghramyan Ave, Yerevan', 40.1932, 44.5003],
  ['Narek Avetisyan', 'narek.avetisyan@example.com', '+374 55 640 927', '', '7 Arshakunyats Ave, Yerevan', 40.1641, 44.4979],
  ['Ani Karapetyan', 'ani.karapetyan@example.com', '+374 91 883 401', 'Northside Café', '3 Northern Ave, Yerevan', 40.1816, 44.5142],
  ['Gor Vardanyan', 'gor.vardanyan@example.com', '+374 99 214 586', '', '15 Davtashen 3rd district, Yerevan', 40.2268, 44.4952],
  ['Sona Mkrtchyan', 'sona.mkrtchyan@example.com', '+374 77 905 213', '', '9 Nor Nork 2nd micro-district, Yerevan', 40.1992, 44.5648],
  ['Hayk Manukyan', 'hayk.manukyan@example.com', '+374 93 437 860', 'Manukyan IT Solutions', '28 Saryan St, Yerevan', 40.1879, 44.5071],
  ['Tatev Ghazaryan', 'tatev.ghazaryan@example.com', '+374 94 120 775', '', '11 Ajapnyak, Halabyan St, Yerevan', 40.1958, 44.4601],
  ['Levon Arakelyan', 'levon.arakelyan@example.com', '+374 98 662 309', '', '6 Erebuni St, Yerevan', 40.1451, 44.5302]
];

var SEED_NOTES = ['', '', 'Please call 10 minutes before arrival', 'Leave at reception', '', 'Office is on the 3rd floor', '', 'Ring the bell twice', ''];

var SEED_EXPENSES = [
  // [days_ago, category, description, amount, notes]
  [58, 'RENT', 'Storage & showroom rent — month 1', 60000, 'Small storage unit, Arabkir'],
  [55, 'MARKETING', 'Instagram & Facebook launch campaign', 25000, ''],
  [52, 'PACKAGING', 'Kraft bags, boxes and labels', 14500, 'Initial packaging stock'],
  [47, 'DELIVERY', 'Courier fuel — weeks 1–3', 8000, ''],
  [44, 'UTILITIES', 'Electricity & internet', 12800, ''],
  [40, 'SUPPLIES', 'Cleaning supplies and tasting cups', 4600, ''],
  [35, 'MARKETING', 'Printed flyers for university cafés', 9500, ''],
  [31, 'SOFTWARE', 'Label printer & barcode app', 6900, 'One-time licence'],
  [28, 'RENT', 'Storage & showroom rent — month 2', 60000, ''],
  [24, 'DELIVERY', 'Courier fuel — weeks 4–6', 9500, ''],
  [21, 'PACKAGING', 'Gift boxes for autumn season', 11000, ''],
  [17, 'MARKETING', 'Influencer coffee tasting event', 18000, ''],
  [14, 'UTILITIES', 'Electricity & internet', 13400, ''],
  [10, 'SUPPLIES', 'Sample beans for cupping session', 6500, ''],
  [6, 'DELIVERY', 'Courier fuel — weeks 7–8', 7200, ''],
  [3, 'OTHER', 'Bank & card terminal fees', 2300, '']
];

/** Deterministic PRNG (mulberry32) so the seed is reproducible. */
function seedRng_(seed) {
  var t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    var r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function daysAgo_(now, days, hour, minute) {
  var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour || 12, minute || 0, 0);
  d.setDate(d.getDate() - days);
  return d;
}

/**
 * Builds all demo rows in memory. Every row is produced by the same rules as live
 * operations (calcOrderTotals_, weightedAverageCost_), so seed data is internally consistent:
 * opening stock → purchases (WAC) → orders (stock ↓, COGS at current cost) → final stock.
 */
function buildSeedPlan_(now) {
  var rng = seedRng_(20261008);
  var settings = {};
  for (var k in DEFAULT_SETTINGS) settings[k] = DEFAULT_SETTINGS[k];
  var created = daysAgo_(now, 75, 9, 0);

  var products = SEED_PRODUCTS.map(function (a, i) {
    return {
      product_id: 'P-' + pad_(i + 1, 4), sku: a[0], category: a[1], name_en: a[2], name_hy: a[3], origin: a[4],
      roast_level: a[5], grind_type: a[6], weight_g: a[7], unit: a[8], sale_price: a[9], unit_cost: a[10],
      target: a[11], reorder_level: a[12], supplier: SUPPLIERS[a[13]], description_en: a[14], description_hy: a[15],
      image_url: 'art:' + a[1], active: true, created_at: created, updated_at: created
    };
  });

  // ---- 1. Plan orders (24) spread over the last ~58 days
  var popularity = { 'coffee-beans': 5, 'ground-coffee': 4, 'instant-coffee': 2, 'syrups-addons': 3,
    'filters-consumables': 2, 'brewing-equipment': 1.4, 'accessories-storage': 1.3 };
  var weights = products.map(function (p) { return popularity[p.category]; });
  var totalW = weights.reduce(function (s, w) { return s + w; }, 0);
  var pick = function () {
    var x = rng() * totalW;
    for (var i = 0; i < weights.length; i++) { x -= weights[i]; if (x <= 0) return i; }
    return weights.length - 1;
  };
  var orders = [];
  var ORDER_COUNT = 24;
  for (var o = 0; o < ORDER_COUNT; o++) {
    var ago = Math.max(1, Math.round(58 - o * (57 / (ORDER_COUNT - 1)) - rng() * 1.2));
    var when = daysAgo_(now, ago, 9 + Math.floor(rng() * 12), Math.floor(rng() * 60));
    var lineCount = 2 + Math.floor(rng() * 4);
    var used = {};
    var lines = [];
    for (var l = 0; l < lineCount; l++) {
      var idx = pick();
      if (used[idx]) continue;
      used[idx] = true;
      var p = products[idx];
      var maxQ = p.sale_price > 15000 ? 1 : (p.sale_price > 7000 ? 2 : 3);
      lines.push({ idx: idx, quantity: 1 + Math.floor(rng() * maxQ) });
    }
    orders.push({ t: when, ago: ago, lines: lines, customer: SEED_CUSTOMERS[Math.floor(rng() * SEED_CUSTOMERS.length)], note: SEED_NOTES[o % SEED_NOTES.length] });
  }
  // Make sure the deliberately sold-out / low products actually sold.
  ['CB-VNM-ROB-1KG', 'GR-DEC-250', 'FL-CLN-TAB-50', 'GR-TRK-CRD-200', 'CB-KEN-AA-250', 'EQ-FRT-ELC'].forEach(function (sku, i) {
    var idx = products.map(function (p) { return p.sku; }).indexOf(sku);
    var target = orders[(i * 4 + 5) % orders.length];
    if (!target.lines.some(function (x) { return x.idx === idx; })) target.lines.push({ idx: idx, quantity: products[idx].sale_price > 15000 ? 1 : 2 });
  });

  // ---- 2. Plan purchases (restocks) and clamp quantities so stock never goes negative.
  var soldAfter = function (idx, t) {
    return orders.reduce(function (s, ord) {
      if (ord.t <= t) return s;
      return s + ord.lines.filter(function (x) { return x.idx === idx; }).reduce(function (a, x) { return a + x.quantity; }, 0);
    }, 0);
  };
  var soldTotal = products.map(function (p, idx) { return soldAfter(idx, new Date(0)); });
  var ranked = products.map(function (p, i) { return i; }).sort(function (a, b) { return soldTotal[b] - soldTotal[a]; });
  var planned = [];
  for (var pi = 0; pi < 22; pi++) {
    var pidx = pi < 14 ? ranked[pi] : Math.floor(rng() * products.length);
    var pr = products[pidx];
    var pAgo = Math.max(2, Math.round(50 - pi * 2.2 - rng() * 2));
    var base = pr.category === 'brewing-equipment' || pr.category === 'accessories-storage' ? 4 + Math.floor(rng() * 6) : 8 + Math.floor(rng() * 17);
    planned.push({ idx: pidx, t: daysAgo_(now, pAgo, 10, 30 + pi), qty: base, cost: Math.round(pr.unit_cost * (0.95 + rng() * 0.12)) });
  }
  planned.sort(function (a, b) { return b.t - a.t; }); // latest first for clamping
  var restockedAfter = products.map(function () { return 0; });
  var purchases = [];
  planned.forEach(function (pp) {
    var allowed = products[pp.idx].target + soldAfter(pp.idx, pp.t) - restockedAfter[pp.idx];
    var qty = Math.min(pp.qty, allowed);
    if (qty <= 0) return;
    pp.qty = qty;
    restockedAfter[pp.idx] += qty;
    purchases.push(pp);
  });

  // ---- 3. Opening stock so that final stock equals the target.
  var restockTotal = products.map(function () { return 0; });
  purchases.forEach(function (pp) { restockTotal[pp.idx] += pp.qty; });
  var stock = products.map(function (p, i) { return p.target + soldTotal[i] - restockTotal[i]; });
  var cost = products.map(function (p) { return p.unit_cost; });

  var rows = { PRODUCTS: [], ORDERS: [], ORDER_ITEMS: [], PURCHASES: [], INVENTORY_LOG: [], EXPENSES: [] };
  var mov = 1;
  var logMove = function (date, p, type, change, before, unitCost, ref, note) {
    rows.INVENTORY_LOG.push({ movement_id: 'MOV-' + pad_(mov++, 6), date: date, product_id: p.product_id, sku: p.sku,
      movement_type: type, quantity_change: change, stock_before: before, stock_after: before + change,
      unit_cost: round2_(unitCost), reference_id: ref, notes: note, created_at: date });
  };
  products.forEach(function (p, i) {
    if (stock[i] > 0) logMove(created, p, 'ADJUSTMENT', stock[i], 0, cost[i], 'OPENING', 'Opening inventory count');
  });

  // ---- 4. Replay purchases + orders chronologically
  var events = [];
  purchases.forEach(function (pp) { events.push({ t: pp.t, type: 'P', data: pp }); });
  orders.forEach(function (ord) { events.push({ t: ord.t, type: 'O', data: ord }); });
  events.sort(function (a, b) { return a.t - b.t; });
  var purSeq = 1;
  var dayCounters = {};
  events.forEach(function (ev) {
    if (ev.type === 'P') {
      var pp = ev.data, p = products[pp.idx];
      var id = 'PUR-' + pad_(purSeq++, 4);
      var newCost = weightedAverageCost_(stock[pp.idx], cost[pp.idx], pp.qty, pp.cost);
      rows.PURCHASES.push({ purchase_id: id, purchase_date: pp.t, supplier: p.supplier, product_id: p.product_id, sku: p.sku,
        quantity: pp.qty, unit_cost: pp.cost, total_cost: pp.qty * pp.cost, currency: 'AMD',
        invoice_reference: 'INV-' + Utilities.formatDate(pp.t, tz_(), 'yyMMdd') + '-' + pad_(purSeq * 7 % 1000, 3),
        notes: 'Restock', created_at: pp.t });
      logMove(pp.t, p, 'PURCHASE', pp.qty, stock[pp.idx], pp.cost, id, 'Supplier purchase · ' + p.supplier);
      stock[pp.idx] += pp.qty;
      cost[pp.idx] = newCost;
      p.updated_at = pp.t;
    } else {
      var ord = ev.data;
      var dk = Utilities.formatDate(ord.t, tz_(), 'yyyyMMdd');
      dayCounters[dk] = (dayCounters[dk] || 0) + 1;
      var orderId = 'ORD-' + dk + '-' + pad_(dayCounters[dk], 4);
      var calcLines = ord.lines.map(function (x) { return { quantity: x.quantity, price: products[x.idx].sale_price, cost: cost[x.idx] }; });
      var totals = calcOrderTotals_(calcLines, settings);
      var status = ord.ago >= 8 ? 'DELIVERED' : (ord.ago >= 4 ? 'SHIPPED' : (ord.ago >= 2 ? 'CONFIRMED' : 'NEW'));
      var c = ord.customer;
      rows.ORDERS.push({ order_id: orderId, order_date: ord.t, customer_name: c[0], customer_email: c[1], customer_phone: "'" + c[2],
        company: c[3], delivery_address: c[4], delivery_latitude: c[5], delivery_longitude: c[6], delivery_notes: ord.note,
        subtotal: totals.subtotal, discount: totals.discount, delivery_fee: totals.delivery_fee, total_amount: totals.total_amount,
        currency: 'AMD', total_cogs: totals.total_cogs, gross_profit: totals.gross_profit, gross_margin_percent: totals.gross_margin_percent,
        payment_method: 'CASH_ON_DELIVERY', payment_status: status === 'DELIVERED' ? 'PAID' : 'PENDING', order_status: status,
        created_at: ord.t, updated_at: ord.t });
      ord.lines.forEach(function (x, li) {
        var p = products[x.idx];
        var lr = x.quantity * p.sale_price, lc = round2_(x.quantity * cost[x.idx]);
        rows.ORDER_ITEMS.push({ order_item_id: orderId + '-' + pad_(li + 1, 2), order_id: orderId, product_id: p.product_id, sku: p.sku,
          product_name: p.name_en, quantity: x.quantity, unit_sale_price: p.sale_price, unit_cost: round2_(cost[x.idx]),
          line_revenue: lr, line_cogs: lc, line_profit: round2_(lr - lc), created_at: ord.t });
        if (stock[x.idx] < x.quantity) throw new Error('Seed planner produced negative stock for ' + p.sku);
        logMove(ord.t, p, 'SALE', -x.quantity, stock[x.idx], cost[x.idx], orderId, 'Customer order');
        stock[x.idx] -= x.quantity;
        p.updated_at = ord.t;
      });
    }
  });

  products.forEach(function (p, i) {
    if (stock[i] !== p.target) throw new Error('Seed stock mismatch for ' + p.sku);
    rows.PRODUCTS.push({ product_id: p.product_id, sku: p.sku, name_hy: p.name_hy, name_en: p.name_en, category: p.category,
      description_hy: p.description_hy, description_en: p.description_en, origin: p.origin, roast_level: p.roast_level,
      grind_type: p.grind_type, weight_g: p.weight_g, unit: p.unit, sale_price: p.sale_price, unit_cost: round2_(cost[i]),
      stock_qty: stock[i], reorder_level: p.reorder_level, supplier: p.supplier, image_url: p.image_url, active: true,
      created_at: p.created_at, updated_at: p.updated_at });
  });

  SEED_EXPENSES.forEach(function (e, i) {
    var d = daysAgo_(now, e[0], 11, 0);
    rows.EXPENSES.push({ expense_id: 'EXP-' + pad_(i + 1, 4), expense_date: d, category: e[1], description: e[2],
      amount: e[3], currency: 'AMD', notes: e[4], created_at: d });
  });
  return rows;
}

function seedDemoData_() {
  var rows = buildSeedPlan_(new Date());
  ['PRODUCTS', 'ORDERS', 'ORDER_ITEMS', 'PURCHASES', 'INVENTORY_LOG', 'EXPENSES'].forEach(function (name) {
    appendRows_(name, rows[name]);
  });
  rebuildReports_();
  return {
    products: rows.PRODUCTS.length, orders: rows.ORDERS.length, order_items: rows.ORDER_ITEMS.length,
    purchases: rows.PURCHASES.length, expenses: rows.EXPENSES.length, inventory_movements: rows.INVENTORY_LOG.length
  };
}

function formatSheet_(sh, name) {
  var headers = SCHEMA[name];
  var head = sh.getRange(1, 1, 1, headers.length);
  head.setValues([headers]).setFontWeight('bold').setBackground('#2b1d14').setFontColor('#f7efe4');
  sh.setFrozenRows(1);
  var money = ['sale_price', 'unit_cost', 'subtotal', 'discount', 'delivery_fee', 'total_amount', 'total_cogs', 'gross_profit',
    'unit_sale_price', 'line_revenue', 'line_cogs', 'line_profit', 'total_cost', 'amount', 'revenue', 'discounts',
    'delivery_income', 'cogs', 'operating_expenses', 'net_profit', 'average_order_value', 'default_delivery_fee',
    'free_delivery_threshold', 'discount_threshold'];
  var dates = ['order_date', 'purchase_date', 'expense_date', 'date', 'created_at', 'updated_at', 'timestamp'];
  var text = ['sku', 'customer_phone', 'admin_pin', 'month', 'report_folder_id', 'invoice_reference'];
  headers.forEach(function (h, i) {
    var col = sh.getRange(2, i + 1, Math.max(1, sh.getMaxRows() - 1), 1);
    if (name === 'REPORT_DAILY' && h === 'date') { col.setNumberFormat('@'); return; }
    if (money.indexOf(h) > -1) col.setNumberFormat('#,##0.##');
    else if (dates.indexOf(h) > -1) col.setNumberFormat(h === 'expense_date' || h === 'purchase_date' ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm');
    else if (text.indexOf(h) > -1) col.setNumberFormat('@');
  });
  try { sh.setColumnWidths(1, headers.length, 130); } catch (e) { /* ignore */ }
}

/**
 * ▶ Run once from the Apps Script editor.
 * Creates missing sheets, headers, formatting, default SETTINGS and (if PRODUCTS is empty)
 * 75 demo products with consistent orders, purchases, inventory movements and expenses.
 */
function setupDatabase() {
  var props = PropertiesService.getScriptProperties();
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    var id = props.getProperty(APP.SS_PROP);
    if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
    if (!ss) ss = SpreadsheetApp.create('Coffee Lab — Database');
  }
  props.setProperty(APP.SS_PROP, ss.getId());
  try { ss.setSpreadsheetTimeZone(APP.TIMEZONE); } catch (e) { /* ignore */ }
  invalidate_();

  SHEET_ORDER.forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    formatSheet_(sh, name);
  });
  // Remove the default empty sheet if present.
  ['Sheet1', 'Лист1', 'Թերթ1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  var settingsSheet = ss.getSheetByName('SETTINGS');
  if (settingsSheet.getLastRow() < 2) {
    settingsSheet.getRange(2, 1, 1, SCHEMA.SETTINGS.length)
      .setValues([SCHEMA.SETTINGS.map(function (h) { return DEFAULT_SETTINGS[h]; })]);
  }

  var summary;
  if (readTable_('PRODUCTS').length === 0) {
    summary = seedDemoData_();
    audit_('setupDatabase', 'SYSTEM', ss.getId(), 'OK', 'Seeded ' + JSON.stringify(summary), 'setup');
  } else {
    rebuildReports_();
    summary = { products: readTable_('PRODUCTS').length, note: 'Existing data kept — reports rebuilt.' };
  }
  var msg = 'Coffee Lab database ready: ' + ss.getUrl() + '\n' + JSON.stringify(summary);
  Logger.log(msg);
  return summary;
}

/** ▶ Wipes all transactional data and re-creates the demo dataset (SETTINGS are kept). */
function resetDemoData() {
  var ss = getSs_();
  SHEET_ORDER.forEach(function (name) {
    if (name === 'SETTINGS') return;
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() >= 2) sh.getRange(2, 1, sh.getLastRow() - 1, SCHEMA[name].length).clearContent();
  });
  invalidate_();
  return setupDatabase();
}

/** ▶ Recalculates REPORT_DAILY and REPORT_MONTHLY from ORDERS + EXPENSES. */
function rebuildReports() {
  invalidate_();
  var r = rebuildReports_();
  Logger.log('Reports rebuilt: ' + JSON.stringify(r));
  return r;
}

/** ▶ Creates a PDF for the last 30 days (handy for testing Drive permissions). */
function generateLast30DaysPdf() {
  var to = dateKey_(new Date());
  var from = dateKey_(new Date(Date.now() - 29 * 24 * 3600 * 1000));
  var r = apiGenerateReportPdf({ from: from, to: to, lang: 'en' });
  Logger.log(r.url);
  return r;
}

function onOpen() {
  try {
    SpreadsheetApp.getUi().createMenu('☕ Coffee Lab')
      .addItem('Setup database', 'setupDatabase')
      .addItem('Rebuild reports', 'rebuildReports')
      .addItem('Generate PDF (last 30 days)', 'generateLast30DaysPdf')
      .addSeparator()
      .addItem('Reset demo data', 'resetDemoData')
      .addToUi();
  } catch (e) { /* not opened from a spreadsheet UI */ }
}
