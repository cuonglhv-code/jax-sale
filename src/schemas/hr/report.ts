import { z } from "zod";

/**
 * US8 (T060–T062, contracts/config-balance.actions.md "Reporting"): boundary validation for the
 * report actions. All fields are optional filters — an absent filter means "no narrowing beyond the
 * caller's own role-scope" (network-wide vs own-centre, resolved server-side from claims, never from
 * this input).
 */
export const reportFilterSchema = z.object({
  startDate: z.string().date("Ngày bắt đầu không hợp lệ").optional(),
  endDate: z.string().date("Ngày kết thúc không hợp lệ").optional(),
  employeeId: z.string().uuid("Mã nhân viên không hợp lệ").optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;

export const outstandingBalancesFilterSchema = z.object({
  leaveYear: z.number().int("Năm nghỉ phép không hợp lệ").min(2000).max(2100),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});
export type OutstandingBalancesFilterInput = z.infer<typeof outstandingBalancesFilterSchema>;

export const coverageViewFilterSchema = z.object({
  startDate: z.string().date("Ngày bắt đầu không hợp lệ"),
  endDate: z.string().date("Ngày kết thúc không hợp lệ"),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});
export type CoverageViewFilterInput = z.infer<typeof coverageViewFilterSchema>;
