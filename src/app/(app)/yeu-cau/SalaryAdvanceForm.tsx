"use client";

import { useState } from "react";
import { useSubmitRequest } from "@/hooks/mutations/hr/useSubmitRequest";
import { Field } from "@/components/form";

/**
 * US5 (T049): the `salary_advance` form — a money form (data-model §10: `isMoneyForm: true`,
 * notifies accounting on approval, T048). No dates, no cover picker.
 */
export function SalaryAdvanceForm() {
  const [amount, setAmount] = useState("");
  const [repaymentIntent, setRepaymentIntent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submitRequest = useSubmitRequest();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await submitRequest.mutateAsync({
        requestType: "salary_advance",
        amount: Number(amount),
        repaymentIntent,
      });
      setAmount("");
      setRepaymentIntent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <Field label="Số tiền tạm ứng (VNĐ)">
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
      <Field label="Phương án hoàn trả">
        <textarea
          value={repaymentIntent}
          onChange={(e) => setRepaymentIntent(e.target.value)}
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
