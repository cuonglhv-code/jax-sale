import { z } from "zod";
import { TASK_GROUPS, TASK_STATUSES, TASK_SOURCES, PRIORITIES } from "@/lib/data/types";

export const listTasksFilterSchema = z.object({
  centreId: z.string().optional(), // uuid or the "all" sentinel (super_admin only — enforced server-side)
  status: z.enum(TASK_STATUSES).optional(),
  group: z.enum(TASK_GROUPS).optional(),
  mine: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
});
export type ListTasksFilter = z.infer<typeof listTasksFilterSchema>;

export const createTaskSchema = z.object({
  assigneeId: z.string().uuid("Người được giao không hợp lệ"),
  departmentId: z.string().uuid("Bộ phận không hợp lệ"),
  description: z.string().min(1, "Vui lòng nhập mô tả công việc"),
  group: z.enum(TASK_GROUPS, { message: "Nhóm công việc không hợp lệ" }),
  priority: z.enum(PRIORITIES, { message: "Mức độ ưu tiên không hợp lệ" }),
  deadline: z.string().min(1, "Vui lòng chọn hạn hoàn thành"),
  source: z.enum(TASK_SOURCES).optional().default("SELF_CREATED"),
  note: z.string().optional(),
});
export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const assignTaskSchema = z.object({
  taskId: z.string().uuid(),
  assigneeId: z.string().uuid("Người được giao không hợp lệ"),
});
export type AssignTaskInput = z.infer<typeof assignTaskSchema>;

export const changeTaskStatusSchema = z.object({
  taskId: z.string().uuid(),
  target: z.enum(TASK_STATUSES).optional(),
  note: z.string().optional(),
});
export type ChangeTaskStatusInput = z.infer<typeof changeTaskStatusSchema>;
