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
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <DateField label="Ngày làm thêm giờ" value={date} onChange={setDate} required />
      <Field label="Số giờ">
        <input
          type="number"
          min="0"
          step="0.5"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          required
          className="rounded border px-2 py-1"
        />
      </Field>
      <Field label="Lý do">
        <input
          value={justification}
          onChange={(e) => setJustification(e.target.value)}
          required
          className="rounded border px-2 py-1"
        />
      </Field>
      <button
        type="submit"
        disabled={submitRequest.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {submitRequest.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
