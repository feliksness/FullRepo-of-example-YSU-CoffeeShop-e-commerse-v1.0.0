// Coffee Lab — admin data loader; signs out automatically on UNAUTHORIZED.
import { useCallback, useEffect, useRef, useState } from "react";
import { useAdmin } from "../context/AdminContext.jsx";

export default function useAdminQuery(loader, deps = []) {
  const { pin, logout } = useAdmin();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const seq = useRef(0);
  const run = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loader(pin);
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (err) {
      if (err.code === "UNAUTHORIZED") logout();
      if (id === seq.current) setState((s) => ({ data: s.data, error: err, loading: false }));
    }
  }, [pin, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { run(); }, [run]);
  return { ...state, reload: run };
}

/** Wraps an admin mutation: returns [run, busy]. */
export function useAdminAction() {
  const { pin, logout } = useAdmin();
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn) => {
    setBusy(true);
    try {
      return await fn(pin);
    } catch (err) {
      if (err.code === "UNAUTHORIZED") logout();
      throw err;
    } finally {
      setBusy(false);
    }
  }, [pin, logout]);
  return [run, busy];
}
