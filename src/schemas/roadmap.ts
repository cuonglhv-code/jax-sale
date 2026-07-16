import { z } from "zod";
import { BANDS, bandValue } from "@/lib/domain/ielts/bands";
import { AUDIENCES, INTENSITIES, EXAM_PURPOSES } from "@/lib/domain/ielts/labels";
import { COURSE_CODES } from "@/lib/domain/ielts/courses";

/**
 * RoadmapRequest input validation (FR-INPUT-02/03). Target band MUST be strictly greater than the
 * current band (AC-1.2). `centreId` is resolved from the caller's claims on submit — NOT trusted
 * from the client — so it is absent from the client-facing form schema.
 */
export const roadmapRequestSchema = z
  .object({
    studentName: z.string().min(1, "Vui lòng nhập tên học viên"),
    audience: z.enum(AUDIENCES, { message: "Vui lòng chọn đối tượng" }),
    studentEmail: z.string().email("Email học viên không hợp lệ"),
    studentPhone: z.string().optional().nullable(),
    currentBand: z.enum(BANDS, { message: "Vui lòng chọn band hiện tại" }),
    targetBand: z.enum(BANDS, { message: "Vui lòng chọn band mục tiêu" }),
    examPurpose: z.enum(EXAM_PURPOSES, { message: "Vui lòng chọn mục đích thi" }),
    targetExamDate: z.string().optional().nullable(),
    intensity: z.enum(INTENSITIES, { message: "Vui lòng chọn cường độ học" }),
    consultantName: z.string().min(1, "Vui lòng nhập tên tư vấn viên"),
    consultantPhone: z.string().optional().nullable(),
    consultantEmail: z.string().email("Email tư vấn viên không hợp lệ").optional().nullable(),
    startDate: z.string().optional().nullable(),
  })
  .refine((v) => bandValue(v.targetBand) > bandValue(v.currentBand), {
    message: "Band mục tiêu phải cao hơn band hiện tại",
    path: ["targetBand"],
  });
export type RoadmapRequestInput = z.infer<typeof roadmapRequestSchema>;

/** Submit payload: the request + engine-derived fields logged for audit (FR-LOG-01). */
export const submitRoadmapSchema = z.object({
  request: roadmapRequestSchema,
  courseSequence: z.array(z.enum(COURSE_CODES)).min(1),
  manualEdited: z.boolean(),
  generationKey: z.string().min(1),
  deliveryStatus: z.enum(["delivered", "drafted", "failed"]),
});
export type SubmitRoadmapInput = z.infer<typeof submitRoadmapSchema>;
