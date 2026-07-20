import { z } from "zod";
import { LEAVE_DAY_PARTS } from "@/lib/data/types";

/**
 * Type-specific schema for `annual_leave` (US1; data-model §10) — registered as this type's
 * `FormDefinition.schema` in `src/lib/domain/hr-forms.ts`. Promoted columns (startDate/endDate/
 * dayPart) map directly to `hr_request` columns; `note` is free text stored in `payload`, never
 * promoted. Pure leaf module — no dependency on hr-forms.ts (avoids a circular import, since
 * hr-forms.ts imports this schema to populate its registry).
 */
export const annualLeaveSchema = z
  .object({
    requestType: z.literal("annual_leave"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
    dayPart: z.enum(LEAVE_DAY_PARTS, { message: "Buổi nghỉ không hợp lệ" }).default("full"),
    note: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  });

export type AnnualLeaveInput = z.infer<typeof annualLeaveSchema>;
