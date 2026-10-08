# ☕ Coffee Lab — Zero-Cost Academic E-Commerce

**Built by FeliksKhangeldyan · 2026**

A fully working bilingual (Հայերեն / English) online store for coffee beans, ground and instant coffee, syrups and brewing equipment. It runs end-to-end on free infrastructure only:

**Storefront → Catalog → Cart → Checkout → OSM delivery pin → Google Apps Script → Google Sheets → Inventory → Financial engine → Dashboard → PDF reports in Google Drive**

> Academic demonstration — no real payment processing. Payment is "Cash on delivery (demo)".

---

## 1. Architecture

```text
Customer
   ↓
GitHub Pages            (static hosting, free)
   ↓
React Frontend          (Vite, HashRouter, LocalStorage cart)
   ↓  POST text/plain JSON  {action, payload}
Google Apps Script API  (doGet / doPost, LockService, all money math)
   ↓
Google Sheets
   ├── PRODUCTS
   ├── ORDERS
   ├── ORDER_ITEMS
   ├── PURCHASES
   ├── INVENTORY_LOG
   ├── EXPENSES
   ├── REPORT_DAILY / REPORT_MONTHLY
   ├── SETTINGS
   └── AUDIT_LOG
             ↓
        Google Drive  →  PDF financial reports
```

**Trust model:** the frontend only sends `product_id` + `quantity` and customer details. Apps Script re-reads prices, costs and stock from Google Sheets, recalculates every total, and is the single source of truth. LocalStorage is used only for the cart, language, checkout draft and last-order receipt.

## 2. Technologies (all free)

| Layer | Tech |
|---|---|
| Frontend | React 18, Vite 5, React Router (HashRouter), plain CSS (glass + neo-brutalist coffee theme) |
| Charts | Recharts |
| Maps | Leaflet + react-leaflet + OpenStreetMap tiles + Nominatim geocoding |
| Backend | Google Apps Script Web App (V8) |
| Database | Google Sheets |
| Files | Google Drive (PDF reports) |
| Hosting / CI | GitHub Pages + GitHub Actions |

## 3. Features

**Customer**
- Home (hero, categories, roaster's picks, best sellers, benefits, delivery info, CTA)
- Shop with **75 products**, search (HY/EN name, origin, SKU, description), 7 category filters, price/name sorting, in-stock filter, stock badges
- Product page (origin, roast, grind, weight, price, availability, quantity, related items)
- Cart in LocalStorage (survives refresh & browser restart, syncs across tabs), live stock checks, discount + free-delivery hints
- Checkout without registration, client + server validation, draft auto-saved, duplicate-submit protection (button lock + idempotent `client_request_id`)
- **OpenStreetMap delivery pin**: click / drag marker, "Use my location", address search, reverse-geocoded address suggestion
- Order confirmation with generated ID (`ORD-YYYYMMDD-NNNN`), map, totals from the server
- Order tracking (order ID + email)
- HY | EN switch everywhere (default Armenian), friendly localized error messages

**Admin (PIN from the SETTINGS sheet, default `2026`)**
- Dashboard: Revenue, Gross profit, Net profit, Orders, AOV, Inventory value, Low stock + charts (revenue/profit over time, orders, sales by category, top products, most profitable products, expense breakdown), low-stock table, date ranges 7/30/90 days/all/custom
- Orders: search, status filter, details with item costs & profit, delivery map + OSM link, status workflow (cancel = stock returned)
- Products: create, edit, activate/deactivate, change price, view cost (WAC) & margin, stock correction (logged), reorder level
- Inventory: valuation per SKU + movement log (PURCHASE / SALE / ADJUSTMENT / RETURN)
- Purchases: record supplier purchases with live weighted-average-cost preview, history
- Expenses: add / edit, categories
- Reports: daily / monthly / custom range tables, product sales analysis, **PDF export to Google Drive** (EN or HY), rebuild report sheets

## 4. Google Sheets schema

| Sheet | Columns |
|---|---|
| PRODUCTS | product_id, sku, name_hy, name_en, category, description_hy, description_en, origin, roast_level, grind_type, weight_g, unit, sale_price, unit_cost, stock_qty, reorder_level, supplier, image_url, active, created_at, updated_at |
| ORDERS | order_id, order_date, customer_name, customer_email, customer_phone, company, delivery_address, delivery_latitude, delivery_longitude, delivery_notes, subtotal, discount, delivery_fee, total_amount, currency, total_cogs, gross_profit, gross_margin_percent, payment_method, payment_status, order_status, created_at, updated_at |
| ORDER_ITEMS | order_item_id, order_id, product_id, sku, product_name, quantity, unit_sale_price, unit_cost, line_revenue, line_cogs, line_profit, created_at |
| PURCHASES | purchase_id, purchase_date, supplier, product_id, sku, quantity, unit_cost, total_cost, currency, invoice_reference, notes, created_at |
| INVENTORY_LOG | movement_id, date, product_id, sku, movement_type, quantity_change, stock_before, stock_after, unit_cost, reference_id, notes, created_at |
| EXPENSES | expense_id, expense_date, category, description, amount, currency, notes, created_at |
| REPORT_DAILY | date, orders, units_sold, revenue, discounts, delivery_income, cogs, gross_profit, gross_margin, operating_expenses, net_profit, average_order_value |
| REPORT_MONTHLY | month, (same metrics as daily) |
| SETTINGS | store_name, currency, default_delivery_fee, free_delivery_threshold, tax_rate, demo_mode, admin_pin, report_folder_id, discount_threshold, discount_rate |
| AUDIT_LOG | timestamp, action, entity_type, entity_id, status, message, source |

Default settings: delivery 1,500 ֏, free delivery from 30,000 ֏, 5% automatic discount from 60,000 ֏, admin PIN `2026`. `discount_threshold` and `discount_rate` extend the required SETTINGS columns. `tax_rate` is informational (prices are VAT-inclusive demo prices).

Product categories: `coffee-beans` (17), `ground-coffee` (10), `instant-coffee` (7), `syrups-addons` (10), `filters-consumables` (5), `brewing-equipment` (12), `accessories-storage` (14) = **75 products**, with 7 low-stock and 3 out-of-stock items at setup.

`image_url` values of the form `art:<category>` render generated SVG product artwork (no external images, zero cost). Any `https://…` URL is shown as a photo.

## 5. API

Endpoint: the Apps Script `/exec` URL in `src/config/config.js`.

```http
POST {APPS_SCRIPT_URL}
Content-Type: text/plain;charset=utf-8

{"action":"getProducts","payload":{}}
```
(`text/plain` avoids a CORS preflight, which Apps Script cannot answer.) Read actions also work as `GET ?action=getProducts` or `?action=getOrder&payload={"order_id":"…","email":"…"}`. Write actions are POST-only.

Response envelope:
```json
{ "success": true, "data": {}, "error": null, "timestamp": "2026-10-08T09:00:00.000Z" }
{ "success": false, "data": null, "error": { "code": "OUT_OF_STOCK", "message": "…", "details": { "items": [] } } }
```

| Action | Access | Payload |
|---|---|---|
| health | public | – |
| getProducts | public | – → `{products, categories, settings}` (no cost/supplier) |
| getProduct | public | `{product_id}` or `{sku}` |
| getCategories | public | – |
| createOrder | public | `{client_request_id, customer:{customer_name, customer_email, customer_phone, company, delivery_address, delivery_latitude, delivery_longitude, delivery_notes}, items:[{product_id, quantity}]}` |
| getOrder | public / admin | `{order_id, email}` (admin: `{order_id, admin_pin}`) |
| verifyAdmin | admin | `{admin_pin}` |
| getDashboard / getFinancialReport | admin | `{from?, to?}` (yyyy-MM-dd) |
| getReportTables | admin | `{from?, to?}` |
| generateReportPdf | admin | `{from?, to?, lang: "en"\|"hy"}` → `{url, download_url, file_id, name}` |
| rebuildReports | admin | – |
| getOrders | admin | `{status?, search?, from?, to?}` |
| updateOrderStatus | admin | `{order_id, status}` (NEW, CONFIRMED, SHIPPED, DELIVERED, CANCELLED) |
| getAdminProducts | admin | – |
| createProduct / updateProduct | admin | `{product:{…}}` / `{product_id, product:{…}}` |
| getInventory | admin | `{log_limit?}` |
| addPurchase / getPurchases | admin | `{purchase:{product_id, quantity, unit_cost, supplier?, invoice_reference?, notes?, purchase_date?}}` |
| addExpense / updateExpense / getExpenses | admin | `{expense:{expense_date, category, description, amount, notes?}}` |

Error codes: `VALIDATION_ERROR`, `MISSING_LOCATION`, `EMPTY_CART`, `OUT_OF_STOCK`, `PRODUCT_UNAVAILABLE`, `ORDER_NOT_FOUND`, `UNAUTHORIZED`, `BUSY`, `PDF_FAILED`, `DUPLICATE_SKU`, `INVALID_TRANSITION`, `NOT_FOUND`, `UNKNOWN_ACTION`, `METHOD_NOT_ALLOWED`, `INTERNAL_ERROR`. Raw Apps Script errors are logged to AUDIT_LOG and never sent to clients.

## 6. Order logic (createOrder)

Validate customer → validate & merge cart → **LockService** → re-read PRODUCTS → use sheet prices/costs → re-check stock → subtotal → discount → delivery fee → total → `ORD-YYYYMMDD-NNNN` → write ORDERS + ORDER_ITEMS → decrease stock → INVENTORY_LOG (SALE) → COGS / gross profit / margin → rebuild REPORT_DAILY & REPORT_MONTHLY → AUDIT_LOG → confirmation. Repeated submissions with the same `client_request_id` return the original order (6 h cache).

## 7. Financial formulas (Apps Script is authoritative)

```text
Gross sales      = Σ(quantity × sale price)
Revenue          = Gross sales − Discounts          (discounts are contra-revenue)
COGS             = Σ(quantity × unit cost at the moment of sale)
Gross Profit     = Revenue − COGS
Gross Margin %   = Gross Profit / Revenue × 100
Net Profit       = Gross Profit + Delivery Income − Operating Expenses
Net Margin %     = Net Profit / (Revenue + Delivery Income) × 100
AOV              = Revenue / Number of Orders
Inventory Value  = Σ(stock_qty × current weighted average cost)
New Average Cost = (stock × old cost + purchased qty × new cost) / (stock + purchased qty)
```
All divisions are zero-safe. Cancelled orders are excluded and their stock is returned (RETURN movement). Unit costs are frozen in ORDER_ITEMS, so later purchases never rewrite historical profitability. Product-level analytics use line values before the order-level discount.

## 8. Setup

### 8.1 Google Sheets + Apps Script backend
1. Create a new Google Sheet (e.g. "Coffee Lab — Database").
2. **Extensions → Apps Script**. Replace the default `Code.gs` with `apps-script/Code.gs` (one file contains the whole backend).
3. Optional: Project Settings → "Show appsscript.json" and paste `apps-script/appsscript.json` (sets the Asia/Yerevan time zone and web-app access).
4. Select the function **`setupDatabase`** → **Run** → authorize (Sheets + Drive). It creates all 10 sheets, headers, formats, SETTINGS defaults, 75 products, 24 orders (87 items), 22 purchases, 16 expenses, ~180 inventory movements and the report sheets. Data is internally consistent (Σ inventory log = stock for every product).
5. **Deploy → New deployment → Web app** — *Execute as:* **Me**, *Who has access:* **Anyone** → Deploy → copy the `/exec` URL.
   - If you already own the deployment `AKfycbyjoTYM…/exec`, use **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**: the URL stays the same.
   - A brand-new deployment gets a new URL → put it in `src/config/config.js`.
6. Test in the browser: `{URL}?action=health` and `{URL}?action=getProducts` must return JSON.

Spreadsheet menu **☕ Coffee Lab**: Setup database · Rebuild reports · Generate PDF (last 30 days) · Reset demo data.
Run `generateLast30DaysPdf` once from the editor if you want to pre-authorize Drive before the demo.

### 8.2 Frontend (local)
```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production build in dist/
```

### 8.3 GitHub Pages deployment
1. Create a GitHub repository and push this folder to the `main` branch.
2. Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The workflow `.github/workflows/deploy.yml` builds and publishes on every push (or run it manually from the Actions tab).
4. Site URL: `https://<user>.github.io/<repo>/`. `base: './'` + HashRouter means no extra path config is needed (routes look like `/#/shop`).

## 9. Admin demo usage
Open `/#/admin`, enter the PIN (default **2026**, change it in SETTINGS → `admin_pin`). The PIN is checked by Apps Script on every admin request; it is a demo-level guard, not production security.

## 10. OpenStreetMap / Leaflet
- Tiles: `tile.openstreetmap.org`, attribution "© OpenStreetMap contributors" shown on every map and in the footer.
- Geocoding: Nominatim (`/reverse` and `/search`, limited to Armenia), throttled to ≤ 1 request/second and debounced as required by the Nominatim usage policy.
- Saved per order: `delivery_latitude`, `delivery_longitude`, `delivery_address`, `delivery_notes`.

## 11. PDF reports
`generateReportPdf` builds an HTML report (summary, monthly overview, sales by category, per-product sales with COGS/profit/margin, inventory value by category, low-stock list, purchases by supplier, expenses by category) → converts it to PDF with `Blob.getAs('application/pdf')` → saves it in the Drive folder **Coffee Lab Reports** (ID stored in SETTINGS) → shares "anyone with the link: view" when the account allows → returns the link to the dashboard. Header: *Coffee Lab · Financial Report · Prepared by FeliksKhangeldyan*; footer: *Academic demonstration — no real payment processing*.

## 12. Limitations
- Demo admin PIN, no user accounts, no real payments.
- Apps Script quotas (≈6 min per execution, limited simultaneous executions) — fine for a class demo, not for production traffic.
- A cold Apps Script request can take 1–3 s.
- Google Workspace domains may block "anyone with link" sharing — the PDF is still saved in your Drive.
- When the backend is unreachable, the shop shows a bundled read-only catalog preview and disables checkout.
- Prices, suppliers, customers and companies are fictional demo data.

## 13. Testing checklist (professor demo)
1. ☐ Open the storefront (Armenian by default) and switch HY ↔ EN.
2. ☐ Browse/search/filter the 75 products; sort by price.
3. ☐ Add products; refresh — the cart persists.
4. ☐ Checkout: try submitting empty → validation messages.
5. ☐ Enter details, drop the pin on the map (or "Use my location").
6. ☐ Place order → order ID `ORD-YYYYMMDD-NNNN` appears.
7. ☐ In Google Sheets: new rows in ORDERS, ORDER_ITEMS, INVENTORY_LOG (SALE); PRODUCTS stock decreased; revenue/COGS/gross profit/margin in the order row.
8. ☐ Admin → Purchases: add 20 units of a low-stock product → stock and weighted cost change (preview shows them before saving); PURCHASES + INVENTORY_LOG rows.
9. ☐ Admin → Expenses: add an expense → net profit on the dashboard drops by that amount.
10. ☐ Dashboard charts and KPIs; change the date range.
11. ☐ Orders → open the new order → see map → change status (cancel returns stock).
12. ☐ Reports → Generate PDF → open it from Google Drive.

The backend logic was verified with an automated test-suite (setup, seed consistency, ordering, idempotency, validation, out-of-stock, WAC, expenses, cancellation, products, reports, PDF) and the full demo flow was run in a headless browser.

---
© 2026 Coffee Lab · Built by **FeliksKhangeldyan**
