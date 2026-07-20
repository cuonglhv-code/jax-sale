import { z } from "zod";

/** T037: boundary validation for `cancelOrWithdrawCore` (contracts/hr-requests.actions.md). */
export const cancelRequestSchema = z.object({
  requestId: z.string().uuid("Mã yêu cầu không hợp lệ"),
});

export type CancelRequestInput = z.infer<typeof cancelRequestSchema>;
