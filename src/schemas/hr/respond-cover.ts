import { z } from "zod";

/** US4 (T043): boundary validation for `respondCoverCore` (key `cover.respond`). */
export const respondCoverSchema = z.object({
  coverId: z.string().uuid("Mã đề cử dạy thay không hợp lệ"),
  accept: z.boolean(),
});

export type RespondCoverInput = z.infer<typeof respondCoverSchema>;
