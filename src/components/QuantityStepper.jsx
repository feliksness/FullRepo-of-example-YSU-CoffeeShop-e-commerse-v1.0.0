import { useI18n } from "../context/LanguageContext.jsx";

export default function QuantityStepper({ value, onChange, min = 1, max = 99, size = "md" }) {
  const { t } = useI18n();
  return (
    <div className={`stepper stepper--${size}`}>
      <button type="button" aria-label={t("common.decrease")} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}>−</button>
      <input
        type="number" inputMode="numeric" min={min} max={max} value={value} aria-label={t("common.qty")}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!isNaN(n)) onChange(Math.max(min, Math.min(max, n)));
        }}
      />
      <button type="button" aria-label={t("common.increase")} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}>+</button>
    </div>
  );
}
