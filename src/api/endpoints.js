/**
 * Coffee Lab — typed wrappers for every backend action.
 * Built by FeliksKhangeldyan
 */
import { apiRequest } from "./client.js";

// Storefront (public)
export const getProducts = () => apiRequest("getProducts");
export const getProduct = (product_id) => apiRequest("getProduct", { product_id });
export const getCategories = () => apiRequest("getCategories");
export const createOrder = (order) => apiRequest("createOrder", order, { timeout: 45000 });
export const getOrder = (order_id, email) => apiRequest("getOrder", { order_id, email });

// Admin (PIN required)
const admin = (action, pin, payload = {}, opts) => apiRequest(action, { ...payload, admin_pin: pin }, opts);
export const verifyAdmin = (pin) => admin("verifyAdmin", pin);
export const getDashboard = (pin, range) => admin("getDashboard", pin, range);
export const getFinancialReport = (pin, range) => admin("getFinancialReport", pin, range);
export const getReportTables = (pin, range) => admin("getReportTables", pin, range);
export const generateReportPdf = (pin, range, lang) => admin("generateReportPdf", pin, { ...range, lang }, { timeout: 90000 });
export const rebuildReports = (pin) => admin("rebuildReports", pin);
export const getOrders = (pin, filters) => admin("getOrders", pin, filters);
export const getOrderAdmin = (pin, order_id) => admin("getOrder", pin, { order_id });
export const updateOrderStatus = (pin, order_id, status) => admin("updateOrderStatus", pin, { order_id, status });
export const getAdminProducts = (pin) => admin("getAdminProducts", pin);
export const createProduct = (pin, product) => admin("createProduct", pin, { product });
export const updateProduct = (pin, product_id, product) => admin("updateProduct", pin, { product_id, product });
export const getInventory = (pin) => admin("getInventory", pin);
export const addPurchase = (pin, purchase) => admin("addPurchase", pin, { purchase });
export const getPurchases = (pin, range) => admin("getPurchases", pin, range);
export const addExpense = (pin, expense) => admin("addExpense", pin, { expense });
export const updateExpense = (pin, expense_id, expense) => admin("updateExpense", pin, { expense_id, expense });
export const getExpenses = (pin, range) => admin("getExpenses", pin, range);
