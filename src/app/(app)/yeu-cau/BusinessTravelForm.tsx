"use client";

import { useState } from "react";
import { useSubmitRequest } from "@/hooks/mutations/hr/useSubmitRequest";
import { DateField, Field } from "@/components/form";

/**
 * US5 (T049): the `business_travel` form — a money form (data-model §10: `isMoneyForm: true`,
 * notifies accounting on approval, T048) that ALSO carries a start/end date range, but is explicitly
 * NOT conflict-scoped (data-model §10's engine table) — no cover picker is shown, unlike the
 * leave-family forms.
 */
export function BusinessTravelForm() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [amount, setAmount] = useState("");
  const [destination, setDestination] = useState("");
  const [justification, setJustification] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submitRequest = useSubmitRequest();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await submitRequest.mutateAsync({
        requestType: "business_travel",
        startDate,
        endDate,
        amount: Number(amount),
        destination,
        justification,
      });
      setStartDate("");
      setEndDate("");
      setAmount("");
      setDestination("");
      setJustification("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <DateField label="Ngày bắt đầu" value={startDate} onChange={setStartDate} required />
      <DateField label="Ngày kết thúc" value={endDate} onChange={setEndDate} required min={startDate || undefined} />
      <Field label="Chi phí dự kiến (VNĐ)">
        <input
          type="number"
          min="0"
          step="1000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="rounded border px-2 py-1"
        />
      </Field>
      <Field label="Nơi công tác">
        <input
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          required
          className="rounded border px-2 py-1"
        />
      </Field>
      <Field label="Lý do">
        <textarea
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
