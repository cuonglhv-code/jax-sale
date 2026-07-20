import { z } from "zod";

/**
 * Type-specific schema for `salary_advance` (US5, T046; data-model §10) — a money form
 * (`isMoneyForm: true`, notifies accounting on approval, US7). `amount` is a promoted column;
 * `repaymentIntent` is payload. Not conflict-scoped, no dates, no leave-balance effect.
 */
export const salaryAdvanceSchema = z.object({
  requestType: z.literal("salary_advance"),
  amount: z.coerce.number().positive("Số tiền tạm ứng phải lớn hơn 0"),
  repaymentIntent: z.string().min(1, "Vui lòng nêu phương án hoàn trả"),
});

export type SalaryAdvanceInput = z.infer<typeof salaryAdvanceSchema>;
