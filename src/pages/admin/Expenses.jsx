// Coffee Lab — operating expenses (add / edit). Expenses reduce net profit.
import { useState } from "react";
import { useI18n } from "../../context/LanguageContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { addExpense, getExpenses, updateExpense } from "../../api/endpoints.js";
import useAdminQuery, { useAdminAction } from "../../hooks/useAdminQuery.js";
import { formatDate, formatMoney, toDateInput } from "../../utils/format.js";
import { errorMessage } from "../../utils/errors.js";
import { AdminError } from "./ui.jsx";

const CATS = ["RENT", "SALARIES", "MARKETING", "PACKAGING", "DELIVERY", "UTILITIES", "SOFTWARE", "SUPPLIES", "OTHER"];
const blank = () => ({ expense_id: "", expense_date: toDateInput(new Date()), category: "MARKETING", description: "", amount: "", notes: "" });

export default function Expenses() {
  const { t, lang } = useI18n();
  const { notify } = useToast();
  const [run, busy] = useAdminAction();
  const { data, error, reload } = useAdminQuery((pin) => getExpenses(pin, {}));
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const editing = !!form.expense_id;

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    const payload = { ...form, amount: Number(form.amount) };
    try {
      await run((pin) => (editing ? updateExpense(pin, form.expense_id, payload) : addExpense(pin, payload)));
      notify(t("admin.expenses.saved"), "success");
      setForm(blank());
      reload();
    } catch (e2) { setErr(e2); }
  };

  return (
    <div className="split">
      <form className="panel" onSubmit={submit}>
        <h3>{editing ? `${t("admin.expenses.edit")} · ${form.expense_id}` : t("admin.expenses.add")}</h3>
        <div className="form-grid">
          <div className="field"><label>{t("admin.expenses.date")}</label><input type="date" required value={form.expense_date} onChange={set("expense_date")} /></div>
          <div className="field"><label>{t("admin.expenses.category")}</label>
            <select value={form.category} onChange={set("category")}>{CATS.map((c) => <option key={c} value={c}>{t(`admin.expenses.cat.${c}`)}</option>)}</select></div>
          <div className="field field--span2"><label>{t("admin.expenses.description")}</label><input required minLength={2} value={form.description} onChange={set("description")} /></div>
          <div className="field"><label>{t("admin.expenses.amount")} (֏)</label><input required type="number" min="1" step="1" value={form.amount} onChange={set("amount")} /></div>
          <div className="field"><label>{t("admin.expenses.notes")}</label><input value={form.notes} onChange={set("notes")} /></div>
        </div>
        {err && <div className="notice notice--error">{errorMessage(err, t)}</div>}
        <div className="form-actions">
          {editing && <button type="button" className="btn btn--ghost" onClick={() => setForm(blank())}>{t("common.cancel")}</button>}
          <button className="btn" disabled={busy}>{busy ? t("common.loading") : t("admin.expenses.submit")}</button>
        </div>
      </form>
      <section className="panel panel--flush">
        <div className="admin-toolbar admin-toolbar--in"><h3>{t("admin.expenses.list")}</h3>{data && <span className="muted small">{t("admin.expenses.total")}: {formatMoney(data.total)}</span>}</div>
        <AdminError error={error} onRetry={reload} />
        <div className="table-wrap table-wrap--tall">
          <table className="table table--compact table--hover">
            <thead><tr><th>{t("admin.expenses.date")}</th><th>{t("admin.expenses.category")}</th><th>{t("admin.expenses.description")}</th><th className="r">{t("admin.expenses.amount")}</th><th /></tr></thead>
            <tbody>
              {(data?.expenses || []).map((x) => (
                <tr key={x.expense_id}>
                  <td className="small">{formatDate(x.expense_date, lang)}</td>
                  <td><span className="tag">{t(`admin.expenses.cat.${x.category}`)}</span></td>
                  <td>{x.description}{x.notes && <div className="muted small">{x.notes}</div>}</td>
                  <td className="r">{formatMoney(x.amount)}</td>
                  <td><button className="btn btn--ghost btn--sm" onClick={() => { setForm({ ...x, amount: String(x.amount) }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{t("common.edit")}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
