import { z } from "zod";
import { LEAVE_DAY_PARTS, PERSONAL_LEAVE_EVENTS } from "@/lib/data/types";
import { coversFieldSchema } from "@/schemas/hr/cover";

/**
 * Type-specific schema for `personal_leave` (US5, T046; data-model §10). Leave-family core
 * (start/end/day_part, conflict-scoped via `covers`) plus a required `event` category (one of
 * `PersonalLeaveEvent`) and free-text `reason`, both stored in `payload` (never promoted columns —
 * data-model §10 lists only start/end/day_part as promoted for this type). Whether documentation is
 * required depends on the event — see `requiresDocument` in `src/lib/domain/hr-forms.ts`, not this
 * schema (schema validates SHAPE; the FormDefinition owns the document-required predicate).
 * Never draws the annual-leave balance (FR-007/FR-014).
 */
export const personalLeaveSchema = z
  .object({
    requestType: z.literal("personal_leave"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
    dayPart: z.enum(LEAVE_DAY_PARTS, { message: "Buổi nghỉ không hợp lệ" }).default("full"),
    event: z.enum(PERSONAL_LEAVE_EVENTS, { message: "Lý do nghỉ việc riêng không hợp lệ" }),
    reason: z.string().optional(),
    covers: coversFieldSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  });

export type PersonalLeaveInput = z.infer<typeof personalLeaveSchema>;
