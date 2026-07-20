import { z } from "zod";

/**
 * Type-specific schema for `overtime` (US5, T046; data-model §10). NOT conflict-scoped (it is not
 * an absence from teaching — no cover is ever required, even on a date the submitter also teaches)
 * and has no leave-balance side effect. `date`/`hours`/`justification` are all payload fields (no
 * promoted columns — data-model §10).
 */
export const overtimeSchema = z.object({
  requestType: z.literal("overtime"),
  date: z.string().min(1, "Vui lòng chọn ngày làm thêm giờ"),
  hours: z.coerce.number().positive("Số giờ làm thêm phải lớn hơn 0"),
  justification: z.string().min(1, "Vui lòng nhập lý do làm thêm giờ"),
});

export type OvertimeInput = z.infer<typeof overtimeSchema>;
