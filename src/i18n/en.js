// Coffee Lab — English dictionary · Built by FeliksKhangeldyan
export default {
  meta: { title: "Coffee Lab — Coffee & brewing gear" },
  nav: { home: "Home", shop: "Shop", cart: "Cart", track: "Track order", admin: "Admin", menu: "Menu", close: "Close" },
  common: {
    addToCart: "Add to cart", added: "Added to cart", viewAll: "View all", back: "Back", retry: "Try again",
    loading: "Loading…", save: "Save", cancel: "Cancel", edit: "Edit", create: "Create", search: "Search",
    all: "All", details: "Details", close: "Close", yes: "Yes", no: "No", total: "Total", qty: "Qty",
    items: "{n} items", item: "1 item", from: "From", to: "To", apply: "Apply", reset: "Reset", optional: "optional",
    perUnit: "per unit", increase: "Increase quantity", decrease: "Decrease quantity", remove: "Remove",
    demoBadge: "Academic demo"
  },
  categories: {
    "coffee-beans": "Coffee Beans", "ground-coffee": "Ground Coffee", "instant-coffee": "Instant & Powder",
    "syrups-addons": "Syrups & Add-ons", "filters-consumables": "Filters & Consumables",
    "brewing-equipment": "Brewing Equipment", "accessories-storage": "Accessories & Storage", other: "Other"
  },
  categoryBlurb: {
    "coffee-beans": "Single origins, blends & specialty lots",
    "ground-coffee": "Ground for cezve, moka, press & filter",
    "instant-coffee": "Freeze-dried, decaf & baking powder",
    "syrups-addons": "Syrups, sugars, creamer & cocoa",
    "filters-consumables": "Paper, steel & cloth filters",
    "brewing-equipment": "Presses, moka pots, grinders, scales",
    "accessories-storage": "Cups, containers & barista tools"
  },
  roast: { light: "Light", "medium-light": "Medium-light", medium: "Medium", "medium-dark": "Medium-dark", dark: "Dark" },
  grind: {
    "whole-bean": "Whole bean", espresso: "Espresso", filter: "Filter", "french-press": "French press", turkish: "Cezve (Turkish)",
    moka: "Moka", "pour-over": "Pour-over", universal: "Universal", instant: "Instant", powder: "Powder"
  },
  unit: { bag: "bag", jar: "jar", bottle: "bottle", pack: "pack", box: "box", pcs: "pc" },
  stock: { in_stock: "In stock", low_stock: "Only {n} left", out_of_stock: "Out of stock" },
  home: {
    eyebrow: "Roasted in small batches · Delivered across Yerevan",
    title: "Better coffee starts with what's in your bag.",
    subtitle: "Fresh beans, precise grinds, honest syrups and the tools to brew them — 75 products picked for people who make coffee at home.",
    ctaShop: "Shop the catalog", ctaBeans: "Explore beans",
    statProducts: "products", statOrigins: "origins", statDelivery: "free delivery from",
    categoriesTitle: "Shop by category", featuredTitle: "Roaster's picks", featuredSub: "Single origins we keep coming back to.",
    bestTitle: "Best sellers", bestSub: "What Yerevan is brewing this month.",
    benefitsTitle: "Why Coffee Lab",
    b1t: "Roast date on every bag", b1d: "We sell beans within weeks of roasting, never months.",
    b2t: "Ground to your brewer", b2d: "Cezve, moka, press or filter — each grind is tuned for its method.",
    b3t: "Map-precise delivery", b3d: "Drop a pin on OpenStreetMap so the courier finds your door.",
    b4t: "Cash on delivery", b4d: "No account, no card. Pay when your coffee arrives.",
    deliveryTitle: "Delivery", deliveryText: "Yerevan delivery in 1–2 working days. {fee} per order, free above {threshold}. Orders above {dthreshold} get {rate}% off automatically.",
    ctaTitle: "Your next bag is a click away.", ctaText: "Add to cart, pin your door, pay on delivery."
  },
  shop: {
    title: "Shop", subtitle: "{n} products", searchPlaceholder: "Search coffee, origin, tool, SKU…",
    sort: "Sort", sortFeatured: "Featured", sortPriceAsc: "Price: low to high", sortPriceDesc: "Price: high to low", sortName: "Name A–Z",
    inStockOnly: "In stock only", empty: "No products match your filters.", clear: "Clear filters", results: "{n} results"
  },
  product: {
    origin: "Origin", roast: "Roast", grind: "Grind", weight: "Weight", category: "Category", sku: "SKU",
    availability: "Availability", quantity: "Quantity", related: "You may also like", notFound: "Product not found.",
    maxReached: "You already have all available units in your cart.", g: "g", ml: "ml"
  },
  cart: {
    title: "Your cart", empty: "Your cart is empty.", emptyCta: "Start shopping", subtotal: "Subtotal",
    discount: "Discount ({rate}%)", delivery: "Delivery", free: "Free", total: "Total", checkout: "Proceed to checkout",
    estimate: "Final prices and stock are confirmed by the server at checkout.",
    freeHint: "Add {amount} more for free delivery.", discountHint: "Add {amount} more to get {rate}% off.",
    unavailable: "No longer available", reduced: "Only {n} available — please reduce quantity", clear: "Clear cart", continue: "Continue shopping",
    persisted: "Saved on this device — your cart survives a refresh."
  },
  checkout: {
    title: "Checkout", contact: "Contact details", delivery: "Delivery location", payment: "Payment", summary: "Order summary",
    name: "Full name", email: "Email", phone: "Phone", company: "Company", address: "Delivery address", notes: "Delivery notes",
    notesPh: "Entrance, floor, intercom code…", phonePh: "+374 91 123 456",
    mapHint: "Click the map or drag the pin to your door.", useMyLocation: "Use my location", locating: "Locating…",
    searchAddress: "Find address", searchPh: "Street, building, district…", searching: "Searching…", noResults: "Nothing found",
    selected: "Selected location", useAddress: "Use this address", noLocation: "No location selected yet",
    cod: "Cash on delivery (demo)", codText: "Academic demo — no real payment is processed. You pay the courier on delivery.",
    place: "Place order", placing: "Placing order…", agree: "This is a university project. Orders are stored in Google Sheets for demonstration.",
    draftSaved: "Your details are saved on this device as you type.", geoDenied: "Location permission was denied.",
    geoUnavailable: "Geolocation is not available in this browser.", searchFailed: "Address search is unavailable right now."
  },
  success: {
    title: "Thank you! Your order is placed.", subtitle: "We'll call you to confirm delivery.", orderId: "Order ID",
    copy: "Copy", copied: "Copied", status: "Status", payment: "Payment", deliverTo: "Deliver to", track: "Track this order",
    keepShopping: "Keep shopping", noOrder: "No recent order on this device."
  },
  track: {
    title: "Track your order", subtitle: "Enter your order ID and the email used at checkout.", orderId: "Order ID",
    email: "Email", find: "Find order", notFound: "We couldn't find an order with these details.", placed: "Placed"
  },
  status: { NEW: "New", CONFIRMED: "Confirmed", SHIPPED: "Shipped", DELIVERED: "Delivered", CANCELLED: "Cancelled",
    PENDING: "Pending", PAID: "Paid", VOID: "Void", CASH_ON_DELIVERY: "Cash on delivery" },
  validation: {
    name: "Please enter your full name (2–80 characters).", email: "Please enter a valid email address.",
    phone: "Please enter a valid phone number, e.g. +374 91 123 456.", address: "Please enter the delivery address (at least 5 characters).",
    location: "Please select the delivery location on the map.", required: "This field is required.",
    positive: "Enter a number greater than zero.", integer: "Enter a whole number."
  },
  errors: {
    NETWORK_ERROR: "Can't reach the store. Check your internet connection and try again.",
    TIMEOUT: "The server took too long to respond. Please try again.",
    BACKEND_UNAVAILABLE: "The store server is unavailable right now. Please try again shortly.",
    BAD_RESPONSE: "The server sent an unexpected response.",
    OUT_OF_STOCK: "Some items are out of stock in the requested quantity. Your cart has been updated.",
    PRODUCT_UNAVAILABLE: "Some products are no longer available.",
    EMPTY_CART: "Your cart is empty.", VALIDATION_ERROR: "Please check the highlighted fields.",
    MISSING_LOCATION: "Please select the delivery location on the map.",
    ORDER_NOT_FOUND: "Order not found.", UNAUTHORIZED: "Wrong admin PIN.", BUSY: "The store is busy. Please try again in a moment.",
    PDF_FAILED: "The PDF report could not be generated.", NOT_FOUND: "Not found.", DUPLICATE_SKU: "This SKU already exists.",
    INVALID_TRANSITION: "This status change is not allowed.", NOT_CONFIGURED: "The database is not set up yet.",
    INTERNAL_ERROR: "Something went wrong. Please try again.", UNKNOWN: "Something went wrong.",
    offlineCatalog: "Showing the offline catalog preview — live stock and checkout need the server.",
    offlineCheckout: "Checkout is unavailable while the server can't be reached."
  },
  footer: {
    tagline: "Coffee beans, grinds and brewing gear for home baristas.",
    shop: "Shop", help: "Help", delivery: "Delivery: Yerevan, 1–2 days", payment: "Payment: cash on delivery (demo)",
    disclaimer: "Academic demonstration — no real payment processing.", map: "Maps © OpenStreetMap contributors",
    rights: "© 2026 Coffee Lab · Built by FeliksKhangeldyan"
  },
  admin: {
    title: "Management", login: "Admin sign-in", pin: "Admin PIN", signIn: "Sign in", signOut: "Sign out",
    pinHint: "Demo PIN is stored in the SETTINGS sheet (default 2026).",
    tabs: { overview: "Overview", orders: "Orders", products: "Products", inventory: "Inventory", purchases: "Purchases", expenses: "Expenses", reports: "Reports" },
    range: { d7: "7 days", d30: "30 days", d90: "90 days", all: "All time", custom: "Custom" },
    kpi: {
      revenue: "Revenue", grossProfit: "Gross profit", netProfit: "Net profit", orders: "Orders", aov: "Avg. order value",
      inventoryValue: "Inventory value", lowStock: "Low stock", cogs: "COGS", grossMargin: "Gross margin", netMargin: "Net margin",
      opex: "Operating expenses", delivery: "Delivery income", discounts: "Discounts", units: "Units sold", purchases: "Purchases",
      grossSales: "Gross sales", outOfStock: "Out of stock"
    },
    charts: {
      revenueProfit: "Revenue & profit over time", orders: "Orders per day", ordersWeekly: "Orders per week", weekly: "weekly totals", byCategory: "Sales by category",
      topProducts: "Top products by units", profitable: "Most profitable products", expenses: "Expense breakdown",
      revenue: "Revenue", grossProfit: "Gross profit", netProfit: "Net profit", ordersSeries: "Orders", units: "Units",
      noData: "No data in this period", table: "Show table", chart: "Show chart"
    },
    lowStockTitle: "Low-stock alert", reorder: "Reorder at", stock: "Stock",
    orders: {
      search: "Search name, email, phone, ID…", status: "Status", allStatuses: "All statuses", date: "Date", customer: "Customer",
      total: "Total", profit: "Profit", items: "Items", view: "View", detail: "Order", changeStatus: "Change status",
      update: "Update status", location: "Delivery location", openOsm: "Open in OpenStreetMap", cost: "Cost", margin: "Margin",
      updated: "Order status updated", cancelWarn: "Cancelling returns all items to stock and removes the order from revenue."
    },
    products: {
      add: "New product", edit: "Edit product", search: "Search name or SKU…", price: "Price", cost: "Unit cost (WAC)",
      margin: "Margin", stock: "Stock", reorder: "Reorder level", active: "Active", inactive: "Inactive", status: "Status",
      nameHy: "Name (Armenian)", nameEn: "Name (English)", descHy: "Description (Armenian)", descEn: "Description (English)",
      category: "Category", origin: "Origin", roast: "Roast level", grind: "Grind", weight: "Weight (g / ml)", unit: "Unit",
      supplier: "Supplier", image: "Image URL", imageHint: "Leave empty for generated artwork.", sku: "SKU",
      openingStock: "Opening stock", openingCost: "Opening unit cost", costHint: "Cost changes only through purchases (weighted average).",
      stockHint: "Changing stock writes an ADJUSTMENT to the inventory log.", saved: "Product saved", created: "Product created",
      activate: "Activate", deactivate: "Deactivate", none: "—"
    },
    inventory: {
      value: "Inventory value", units: "Units in stock", skus: "SKUs", movements: "Recent inventory movements", type: "Type",
      change: "Change", before: "Before", after: "After", ref: "Reference", note: "Note",
      PURCHASE: "Purchase", SALE: "Sale", ADJUSTMENT: "Adjustment", RETURN: "Return"
    },
    purchases: {
      add: "Record supplier purchase", product: "Product", choose: "Choose a product…", quantity: "Quantity", unitCost: "Unit cost",
      totalCost: "Total cost", supplier: "Supplier", invoice: "Invoice reference", notes: "Notes", date: "Purchase date",
      submit: "Add purchase", history: "Purchase history", preview: "After this purchase", currentStock: "Current stock",
      currentCost: "Current cost", newStock: "New stock", newCost: "New average cost", done: "Purchase recorded: stock {a} → {b}, cost {c} → {d}"
    },
    expenses: {
      add: "Add expense", edit: "Edit expense", date: "Date", category: "Category", description: "Description", amount: "Amount",
      notes: "Notes", submit: "Save expense", list: "Expenses", total: "Total", saved: "Expense saved",
      cat: { RENT: "Rent", SALARIES: "Salaries", MARKETING: "Marketing", PACKAGING: "Packaging", DELIVERY: "Delivery",
        UTILITIES: "Utilities", SOFTWARE: "Software", SUPPLIES: "Supplies", OTHER: "Other" }
    },
    reports: {
      title: "Financial reports", daily: "Daily", monthly: "Monthly", custom: "Custom range", generate: "Generate PDF",
      generating: "Generating PDF…", ready: "PDF saved to Google Drive", open: "Open PDF", download: "Download",
      rebuild: "Rebuild report sheets", rebuilt: "Report sheets rebuilt", lang: "PDF language", date: "Date", month: "Month",
      summary: "Summary for selected period", sales: "Sales analysis", product: "Product"
    }
  }
};
