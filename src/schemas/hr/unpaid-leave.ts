import { z } from "zod";
import { LEAVE_DAY_PARTS } from "@/lib/data/types";
import { coversFieldSchema } from "@/schemas/hr/cover";

/**
 * Type-specific schema for `unpaid_leave` (US5, T046; data-model §10). Leave-family core
 * (start/end/day_part, conflict-scoped via `covers`) plus a free-text `reason` in `payload`. Needs
 * neither the annual-leave balance (FR-007/FR-014) nor documentation (`requiresDocument: false`).
 */
export const unpaidLeaveSchema = z
  .object({
    requestType: z.literal("unpaid_leave"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
    dayPart: z.enum(LEAVE_DAY_PARTS, { message: "Buổi nghỉ không hợp lệ" }).default("full"),
    reason: z.string().optional(),
    covers: coversFieldSchema,
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  });

export type UnpaidLeaveInput = z.infer<typeof unpaidLeaveSchema>;
