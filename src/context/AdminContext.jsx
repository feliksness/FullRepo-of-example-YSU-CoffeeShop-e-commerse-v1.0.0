// Coffee Lab — demo admin session (PIN verified by Apps Script, kept in sessionStorage).
import { createContext, useCallback, useContext, useState } from "react";
import { verifyAdmin } from "../api/endpoints.js";

const AdminContext = createContext(null);
const KEY = "coffeelab:adminPin";

export function AdminProvider({ children }) {
  const [pin, setPin] = useState(() => {
    try { return sessionStorage.getItem(KEY) || ""; } catch { return ""; }
  });
  const login = useCallback(async (candidate) => {
    await verifyAdmin(candidate);
    try { sessionStorage.setItem(KEY, candidate); } catch { /* ignore */ }
    setPin(candidate);
  }, []);
  const logout = useCallback(() => {
    try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
    setPin("");
  }, []);
  return <AdminContext.Provider value={{ pin, login, logout, isAdmin: !!pin }}>{children}</AdminContext.Provider>;
}

export const useAdmin = () => useContext(AdminContext);
