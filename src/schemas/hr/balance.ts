import { z } from "zod";

/**
 * T027: boundary validation for `adjustOpeningBalanceCore` (data-model §11/§13, key
 * `leaveBalance.adjust`, super_admin only). Vietnamese messages per the project's inline-Zod-message
 * exception.
 */
export const adjustBalanceSchema = z.object({
  employeeId: z.string().uuid("Mã nhân viên không hợp lệ"),
  leaveYear: z.number().int("Năm nghỉ phép không hợp lệ").min(2000).max(2100),
  deltaDays: z.number().refine((v) => v !== 0, { message: "Số ngày điều chỉnh phải khác 0" }),
  reason: z.string().min(1, "Vui lòng nhập lý do điều chỉnh"),
});

export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
