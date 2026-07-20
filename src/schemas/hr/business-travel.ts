import { z } from "zod";

/**
 * Type-specific schema for `business_travel` (US5, T046; data-model §10) — a money form
 * (`isMoneyForm: true`, notifies accounting on approval, US7) that ALSO carries a start/end date
 * range (promoted columns, alongside `amount`) — but per data-model §10's engine table, business
 * travel is explicitly NOT conflict-scoped ("no" in the Conflict column): it is travel, not an
 * absence from a taught session in the sense the cover mechanism exists for, so no cover resolver
 * runs and no cover_assignment rows are ever created for it. `destination`/`justification` are
 * payload.
 */
export const businessTravelSchema = z
  .object({
    requestType: z.literal("business_travel"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu công tác"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc công tác"),
    amount: z.coerce.number().positive("Chi phí công tác phải lớn hơn 0"),
    destination: z.string().min(1, "Vui lòng nhập nơi công tác"),
    justification: z.string().min(1, "Vui lòng nhập lý do công tác"),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  });

export type BusinessTravelInput = z.infer<typeof businessTravelSchema>;
