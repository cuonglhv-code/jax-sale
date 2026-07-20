import { z } from "zod";

/**
 * T034: boundary validation for `decideRequestCore` (contracts/hr-requests.actions.md — decideRequest,
 * key `hrRequest.decide`). `reject` requires a non-empty `reason` (FR-027); `approve` ignores it.
 */
export const decideRequestSchema = z
  .object({
    requestId: z.string().uuid("Mã yêu cầu không hợp lệ"),
    decision: z.enum(["approve", "reject"], { message: "Quyết định không hợp lệ" }),
    reason: z.string().optional(),
  })
  .refine((data) => data.decision !== "reject" || !!data.reason?.trim(), {
    message: "Vui lòng nhập lý do từ chối",
    path: ["reason"],
  });

export type DecideRequestInput = z.infer<typeof decideRequestSchema>;
