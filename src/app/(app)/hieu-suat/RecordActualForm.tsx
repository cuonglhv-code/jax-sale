"use client";

import { useState } from "react";
import { useRecordActual } from "@/hooks/mutations/useRecordActual";
import { METRIC_KEYS } from "@/lib/data/types";
import { METRIC_LABEL } from "@/lib/domain/vocabulary";
import { Field, SelectField } from "@/components/form";

const inputClass = "rounded border px-2 py-1";

/** US1: a consultant records their OWN actual for the current period (AC-1.1). */
export function RecordActualForm({ period }: { period: string }) {
  const [metricKey, setMetricKey] = useState<(typeof METRIC_KEYS)[number]>(METRIC_KEYS[0]);
  const [actual, setActual] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recordActual = useRecordActual();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordActual.mutateAsync({ period, metricKey, actual: Number(actual) });
      setActual("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border p-4">
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
          onChange={(e) => setActual(e.target.value)}
          className={inputClass}
        />
      </Field>
      <button
        type="submit"
        disabled={recordActual.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {recordActual.isPending ? "Đang lưu..." : "Ghi nhận kết quả"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
