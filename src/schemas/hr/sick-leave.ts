import { z } from "zod";
import { LEAVE_DAY_PARTS } from "@/lib/data/types";
import { coversFieldSchema } from "@/schemas/hr/cover";

/**
 * Type-specific schema for `sick_leave` (US5, T046; data-model §10). Same leave-family core as
 * `annual_leave` (start/end/day_part promoted columns, conflict-scoped via `covers`), but carries
 * NO `note` payload field — sick leave's only payload is the documentation flag itself, which
 * `requiresDocument: true` on the FormDefinition records; the actual attachment upload is US6.
 * Never draws the annual-leave balance (FR-007/FR-014) — the FormDefinition's `sideEffect: "none"`
 * enforces that, not this schema.
 */
export const sickLeaveSchema = z
  .object({
    requestType: z.literal("sick_leave"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
    dayPart: z.enum(LEAVE_DAY_PARTS, { message: "Buổi nghỉ không hợp lệ" }).default("full"),
    covers: coversFieldSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  });

export type SickLeaveInput = z.infer<typeof sickLeaveSchema>;
