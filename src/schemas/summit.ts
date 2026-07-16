import { z } from "zod";
import { BANDS, bandValue } from "@/lib/domain/ielts/bands";
import { COURSE_CODES } from "@/lib/domain/ielts/courses";

/**
 * Summit boundary schemas (spec 005 FR-030 opening; contracts/delivery-archive.md send input).
 * Placement is a discriminated union — mode is data, not styling (Constitution III).
 */

export const placementSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("measured"), testDate: z.string().nullable() }),
  z.object({ kind: z.literal("estimated") }),
]);

export const summitRequestSchema = z
  .object({
    studentName: z.string().min(1, "Vui lòng nhập tên học viên"),
    currentBand: z.enum(BANDS, { message: "Vui lòng chọn band hiện tại" }),
    targetBand: z.enum(BANDS, { message: "Vui lòng chọn band mục tiêu" }),
    placement: placementSchema,
  })
  .refine((v) => bandValue(v.targetBand) > bandValue(v.currentBand), {
    message: "Band mục tiêu phải cao hơn band hiện tại",
    path: ["targetBand"],
  });
export type SummitRequestInput = z.infer<typeof summitRequestSchema>;

/** Send-time contact capture (FR-020). Centre comes from verified claims — never from here. */
export const captureSchema = z.object({
  studentEmail: z.string().email("Email học viên không hợp lệ"),
  studentPhone: z.string().nullable(),
  consultantName: z.string().min(1, "Vui lòng nhập tên tư vấn viên"),
  consultantPhone: z.string().nullable(),
  consultantEmail: z.string().email("Email tư vấn viên không hợp lệ").nullable(),
});
export type CaptureInput = z.infer<typeof captureSchema>;

/** sendSummitRoadmap action input (contracts/delivery-archive.md). */
export const sendSummitRoadmapSchema = z.object({
  generationKey: z.string().min(1),
  request: summitRequestSchema,
  capture: captureSchema,
  courseSequence: z.array(z.enum(COURSE_CODES)).min(1),
  totalPrice: z.number().int().nonnegative(),
  manualEdited: z.boolean(),
  /** Base64-encoded client-generated PDF — the exact reviewed document (SC-003). */
  pdfBase64: z.string().min(1),
});
export type SendSummitRoadmapInput = z.infer<typeof sendSummitRoadmapSchema>;
