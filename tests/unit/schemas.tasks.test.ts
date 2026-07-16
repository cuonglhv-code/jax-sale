import { describe, it, expect } from "vitest";
import { createTaskSchema } from "@/schemas/tasks";

/** US3 (T039): create/assign schemas reject missing deadline / invalid enum values (FR-023). */
describe("schemas: createTaskSchema", () => {
  const valid = {
    assigneeId: "10000000-0000-4000-8000-000000000006",
    departmentId: "00000000-0000-4000-8000-0000000000d4",
    description: "Việc hợp lệ",
    group: "GIANG_DAY",
    priority: "MID",
    deadline: "2026-12-31",
  };

  it("accepts a fully valid input", () => {
    expect(createTaskSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a missing deadline", () => {
    const { deadline: _deadline, ...withoutDeadline } = valid;
    expect(createTaskSchema.safeParse(withoutDeadline).success).toBe(false);
  });

  it("rejects an invalid group enum value", () => {
    expect(createTaskSchema.safeParse({ ...valid, group: "NOT_A_REAL_GROUP" }).success).toBe(false);
  });

  it("rejects an invalid priority enum value", () => {
    expect(createTaskSchema.safeParse({ ...valid, priority: "URGENT" }).success).toBe(false);
  });

  it("rejects an empty description", () => {
    expect(createTaskSchema.safeParse({ ...valid, description: "" }).success).toBe(false);
  });
});
