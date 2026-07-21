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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      <Field label="Số tiền tạm ứng (VNĐ)">
        <input
          type="number"
          min="0"
          step="1000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          className="h-10 w-48 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] [font-variant-numeric:tabular-nums] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
        />
      </Field>
      <Field label="Phương án hoàn trả">
        <textarea
          value={repaymentIntent}
          onChange={(e) => setRepaymentIntent(e.target.value)}
          required
          rows={2}
          className="resize-vertical rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 py-2.5 text-[13.5px] leading-normal text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
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
