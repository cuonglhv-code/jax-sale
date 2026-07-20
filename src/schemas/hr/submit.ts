import { z } from "zod";
import { LEAVE_DAY_PARTS } from "@/lib/data/types";
import { coversFieldSchema } from "@/schemas/hr/cover";

/**
 * Type-specific schema for `annual_leave` (US1; data-model §10) — registered as this type's
 * `FormDefinition.schema` in `src/lib/domain/hr-forms.ts`. Promoted columns (startDate/endDate/
 * dayPart) map directly to `hr_request` columns; `note` is free text stored in `payload`, never
 * promoted. Pure leaf module — no dependency on hr-forms.ts (avoids a circular import, since
 * hr-forms.ts imports this schema to populate its registry).
 *
 * `covers` (US4, T042): optional cover nominations submitted alongside the leave request when it
 * overlaps taught sessions — required by `submitRequestCore` (not by this schema) once the conflict
 * resolver finds affected sessions, since whether it's required depends on server-side resolution
 * against the LIVE timetable, not on client-supplied data.
 */
export const annualLeaveSchema = z
  .object({
    requestType: z.literal("annual_leave"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
    dayPart: z.enum(LEAVE_DAY_PARTS, { message: "Buổi nghỉ không hợp lệ" }).default("full"),
    note: z.string().optional(),
    covers: coversFieldSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  });

export type AnnualLeaveInput = z.infer<typeof annualLeaveSchema>;
