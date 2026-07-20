import { z } from "zod";

/**
 * Type-specific schema for `purchase` (US5, T046; data-model §10) — a money form
 * (`isMoneyForm: true`, notifies accounting on approval, US7). `amount` is a promoted column;
 * `item`/`vendor`/`justification` are payload. Not conflict-scoped, no dates, no leave-balance effect.
 */
export const purchaseSchema = z.object({
  requestType: z.literal("purchase"),
  amount: z.coerce.number().positive("Số tiền đề nghị mua sắm phải lớn hơn 0"),
  item: z.string().min(1, "Vui lòng nhập tên vật phẩm/dịch vụ"),
  vendor: z.string().optional(),
  justification: z.string().min(1, "Vui lòng nhập lý do đề nghị mua sắm"),
});

export type PurchaseInput = z.infer<typeof purchaseSchema>;
