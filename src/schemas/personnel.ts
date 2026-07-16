import { z } from "zod";

export const deactivateEmployeeSchema = z.object({
  employeeId: z.string().uuid("Nhân viên không hợp lệ"),
});
export type DeactivateEmployeeInput = z.infer<typeof deactivateEmployeeSchema>;
