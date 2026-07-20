import { z } from "zod";

/**
 * US4 (T042): one cover nomination submitted alongside a conflict-scoped request (annual_leave,
 * shift_swap, …). Shared by every conflict-scoped `FormDefinition.schema` — each names the exact
 * affected class/session and the proposed covering teacher; the service re-validates every field
 * server-side (same-centre, active teacher, no hard conflict) regardless of what the client sends.
 */
export const coverNominationSchema = z.object({
  classId: z.string().uuid("Mã lớp không hợp lệ"),
  sessionDate: z.string().min(1, "Vui lòng chọn ngày buổi học"),
  nomineeId: z.string().uuid("Vui lòng chọn giáo viên dạy thay"),
});

export type CoverNominationInput = z.infer<typeof coverNominationSchema>;

/** Optional array of cover nominations — present only on conflict-scoped submissions. */
export const coversFieldSchema = z.array(coverNominationSchema).optional();
