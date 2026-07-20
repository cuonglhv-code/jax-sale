import { z } from "zod";

/**
 * T041: boundary validation for `upsertClassCore` (contracts/cover-timetable.actions.md —
 * upsertClass, key `timetable.manage`). `centreId` is deliberately NOT a field here — it is always
 * derived from the caller's claims inside the guarded `upsert_class` RPC, never accepted from input.
 */
export const upsertClassSchema = z
  .object({
    id: z.string().uuid("Mã lớp không hợp lệ").optional(),
    courseLabel: z.string().min(1, "Vui lòng nhập tên lớp"),
    teacherId: z.string().uuid("Vui lòng chọn giáo viên"),
    weekday: z.number().int().min(1, "Thứ không hợp lệ").max(7, "Thứ không hợp lệ"),
    startTime: z.string().min(1, "Vui lòng chọn giờ bắt đầu"),
    endTime: z.string().min(1, "Vui lòng chọn giờ kết thúc"),
    startDate: z.string().min(1, "Vui lòng chọn ngày bắt đầu"),
    endDate: z.string().min(1, "Vui lòng chọn ngày kết thúc"),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "Ngày kết thúc phải sau hoặc bằng ngày bắt đầu",
    path: ["endDate"],
  })
  .refine((data) => data.endTime > data.startTime, {
    message: "Giờ kết thúc phải sau giờ bắt đầu",
    path: ["endTime"],
  });

export type UpsertClassInput = z.infer<typeof upsertClassSchema>;
