"use client";

import { useState } from "react";
import { useSubmitRequest } from "@/hooks/mutations/hr/useSubmitRequest";
import { DateField, Field } from "@/components/form";

/**
 * US5 (T049): the `overtime` form — date + hours + justification, NOT conflict-scoped (data-model
 * §10: overtime is not an absence from teaching, so no cover picker is shown, unlike the
 * leave-family forms), and no balance display (no leave-balance side effect).
 */
export function OvertimeForm() {
  const [date, setDate] = useState("");
  const [hours, setHours] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submitRequest = useSubmitRequest();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await submitRequest.mutateAsync({
        requestType: "overtime",
        date,
        hours: Number(hours),
        justification,
      });
      setDate("");
      setHours("");
      setJustification("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <DateField label="Ngày làm thêm giờ" value={date} onChange={setDate} required />
      <Field label="Số giờ">
        <input
          type="number"
          min="0"
          step="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          required
          className="h-10 w-32 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] [font-variant-numeric:tabular-nums] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
        />
      </Field>
      <Field label="Lý do">
        <input
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          required
          className="h-10 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
        />
      </Field>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitRequest.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-field)] bg-navy px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-dark disabled:cursor-default disabled:opacity-80"
        >
          {submitRequest.isPending && (
            <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-navy-tint-2" style={{ borderTopColor: "white" }} />
          )}
          {submitRequest.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
        </button>
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
    </form>
  );
}
