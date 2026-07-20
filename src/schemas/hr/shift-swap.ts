import { z } from "zod";
import { coverNominationSchema } from "@/schemas/hr/cover";

/**
 * Type-specific schema for `shift_swap` (US4, T044; data-model §10 — payload: `note` only). Unlike
 * the leave family, shift-swap has NO date-range/day-part promoted columns and NO leave-balance
 * side effect: it is a standalone use of the cover mechanism (FR-021) — the submitter directly names
 * the ONE class/session they want covered and the nominee, rather than having the resolver derive
 * affected sessions from a leave range. `cover` is therefore REQUIRED (not optional, unlike the
 * leave family's `covers[]` which is only required once the resolver finds an overlap).
 */
export const shiftSwapSchema = z.object({
  requestType: z.literal("shift_swap"),
  note: z.string().optional(),
  cover: coverNominationSchema,
});

export type ShiftSwapInput = z.infer<typeof shiftSwapSchema>;
