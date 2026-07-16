/**
 * Boundary validation for the KPI slice (#003). Parsed at the server-action boundary before any
 * service logic (constitution III). Vietnamese messages. Zero targets are rejected (D-ZERO) — "no
 * target" is expressed by NULL, not 0.
 */

import { z } from "zod";
import { METRIC_KEYS } from "@/lib/data/types";

const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ không hợp lệ (YYYY-MM)");
const metricKey = z.enum(METRIC_KEYS);
const positiveTarget = z.number().int().positive("Mục tiêu phải lớn hơn 0"); // D-ZERO

export const recordActualInput = z.object({
  period,
  metricKey,
  actual: z.number().int().min(0, "Kết quả không được âm"),
});
export type RecordActualInput = z.infer<typeof recordActualInput>;

export const setPersonalTargetInput = z.object({
  consultantId: z.string().uuid(),
  period,
  metricKey,
  target: positiveTarget.nullable(),
});
export type SetPersonalTargetInput = z.infer<typeof setPersonalTargetInput>;

export const setDepartmentTargetInput = z.object({
  departmentId: z.string().uuid(),
  period,
  metricKey,
  target: positiveTarget.nullable(),
});
export type SetDepartmentTargetInput = z.infer<typeof setDepartmentTargetInput>;

export const approveInput = z.object({ entryId: z.string().uuid() });
export type ApproveInput = z.infer<typeof approveInput>;

export const rejectInput = z.object({
  entryId: z.string().uuid(),
  note: z.string().max(500).optional(),
});
export type RejectInput = z.infer<typeof rejectInput>;
