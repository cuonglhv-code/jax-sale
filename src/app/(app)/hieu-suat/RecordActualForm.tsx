"use client";

import { useState } from "react";
import { useRecordActual } from "@/hooks/mutations/useRecordActual";
import { METRIC_KEYS } from "@/lib/data/types";
import { METRIC_LABEL } from "@/lib/domain/vocabulary";
import { Field, SelectField } from "@/components/form";

/**
 * US1: a consultant records their OWN actual for the current period (AC-1.1). One metric at a time
 * (select + value + submit) — the mutation is per-metric, unlike design_handoff_jax_sales_phase2's
 * mock (which shows all metrics as parallel inline inputs); this keeps the real submit-one-at-a-time
 * behavior and just applies the reference's card/token treatment.
 */
export function RecordActualForm({ period }: { period: string }) {
  const [metricKey, setMetricKey] = useState<(typeof METRIC_KEYS)[number]>(METRIC_KEYS[0]);
  const [actual, setActual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const recordActual = useRecordActual();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJustSubmitted(false);
    try {
      await recordActual.mutateAsync({ period, metricKey, actual: Number(actual) });
      setActual("");
      setJustSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-red" />
        <h2 className="m-0 text-[14.5px] font-bold text-text">Nhập kết quả kỳ</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5 p-4">
        <SelectField
          label="Chỉ số"
          value={metricKey}
          onChange={(v) => setMetricKey(v as (typeof METRIC_KEYS)[number])}
          options={METRIC_KEYS.map((k) => ({ value: k, label: METRIC_LABEL[k] }))}
        />
        <Field label="Kết quả thực tế">
          <input
            type="number"
            min={0}
            required
            value={actual}
            onChange={(e) => {
              setActual(e.target.value);
              setJustSubmitted(false);
            }}
            className="h-10 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] [font-variant-numeric:tabular-nums] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
          />
        </Field>
        {justSubmitted && !error && (
          <div className="flex items-center gap-1.5 rounded-lg border border-att-ontrack-border bg-att-ontrack-bg px-2.5 py-2 text-[12.5px] font-semibold text-att-ontrack-text">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Đã gửi kết quả, chờ quản lý duyệt
          </div>
        )}
        <button
          type="submit"
          disabled={recordActual.isPending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--radius-field)] bg-navy text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-dark disabled:cursor-default disabled:opacity-80"
        >
          {recordActual.isPending && (
            <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-navy-tint-2" style={{ borderTopColor: "white" }} />
          )}
          {recordActual.isPending ? "Đang lưu..." : "Ghi nhận kết quả"}
        </button>
        {error && <p className="text-sm text-red">{error}</p>}
      </form>
    </section>
  );
}
