"use client";

import { useEffect, useState } from "react";
import { useSetPersonalTarget } from "@/hooks/mutations/useSetPersonalTarget";
import { listAssignableEmployees, type AssignableEmployee } from "@/app/actions/tasks/list-assignable-employees";
import { METRIC_KEYS } from "@/lib/data/types";
import { METRIC_LABEL } from "@/lib/domain/vocabulary";
import { Field, SelectField } from "@/components/form";

/**
 * US2 (AC-2.1/2.5): a centre manager/admin sets or clears a per-consultant target in their centre.
 * One consultant/metric/value at a time (matches the real per-target mutation) — the reference's
 * "Đặt mục tiêu tư vấn" mock shows an editable-table-per-metric-column layout for ALL consultants at
 * once, which isn't how the underlying mutation works; this keeps the real picker+value+submit
 * shape and applies the reference's card/token/loading-state treatment instead.
 */
export function TargetEditor({ period }: { period: string }) {
  const [employees, setEmployees] = useState<AssignableEmployee[]>([]);
  const [consultantId, setConsultantId] = useState("");
  const [metricKey, setMetricKey] = useState<(typeof METRIC_KEYS)[number]>(METRIC_KEYS[0]);
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const setPersonalTarget = useSetPersonalTarget();

  useEffect(() => {
    listAssignableEmployees().then((result) => {
      if ("data" in result) {
        setEmployees(result.data);
        if (result.data[0]) setConsultantId(result.data[0].id);
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setJustSaved(false);
    try {
      await setPersonalTarget.mutateAsync({
        consultantId,
        period,
        metricKey,
        target: target === "" ? null : Number(target),
      });
      setTarget("");
      setJustSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3.5">
        <span className="h-4 w-[3px] rounded-sm bg-red" />
        <h2 className="m-0 text-[14.5px] font-bold text-text">Đặt mục tiêu tư vấn</h2>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 p-4">
        <SelectField
          label="Tư vấn viên"
          value={consultantId}
          onChange={setConsultantId}
          options={employees.map((e) => ({ value: e.id, label: e.fullName }))}
        />
        <SelectField
          label="Chỉ số"
          value={metricKey}
          onChange={(v) => setMetricKey(v as (typeof METRIC_KEYS)[number])}
          options={METRIC_KEYS.map((k) => ({ value: k, label: METRIC_LABEL[k] }))}
        />
        <Field label="Mục tiêu (để trống để bỏ mục tiêu)">
          <input
            type="number"
            min={1}
            value={target}
            onChange={(e) => {
              setTarget(e.target.value);
              setJustSaved(false);
            }}
            className="h-10 w-32 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] [font-variant-numeric:tabular-nums] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
          />
        </Field>
        {justSaved && !error && (
          <span className="text-xs font-semibold text-att-ontrack-text">Đã lưu mục tiêu</span>
        )}
        <button
          type="submit"
          disabled={setPersonalTarget.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-field)] bg-navy px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-dark disabled:cursor-default disabled:opacity-80"
        >
          {setPersonalTarget.isPending && (
            <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-navy-tint-2" style={{ borderTopColor: "white" }} />
          )}
          {setPersonalTarget.isPending ? "Đang lưu..." : "Đặt mục tiêu"}
        </button>
        {error && <p className="w-full text-sm text-red">{error}</p>}
      </form>
    </section>
  );
}
