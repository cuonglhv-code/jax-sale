import { describe, it, expect } from "vitest";
import { roadmapRequestSchema } from "@/schemas/roadmap";

/** US1 (T029) — form validation: target > current, email format, required fields (AC-1.2/1.3/1.4). */
const valid = {
  studentName: "Học viên A",
  audience: "THPT" as const,
  studentEmail: "a@example.com",
  studentPhone: "0900",
  currentBand: "3.5" as const,
  targetBand: "6.5" as const,
  examPurpose: "XET_TUYEN_DH" as const,
  targetExamDate: null,
  intensity: "TIEU_CHUAN" as const,
  consultantName: "TV B",
  consultantPhone: null,
  consultantEmail: null,
  startDate: null,
};

describe("schema: roadmapRequestSchema", () => {
  it("accepts a fully valid request", () => {
    expect(roadmapRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects target band ≤ current band (AC-1.2)", () => {
    expect(roadmapRequestSchema.safeParse({ ...valid, currentBand: "6.5", targetBand: "6.5" }).success).toBe(false);
    expect(roadmapRequestSchema.safeParse({ ...valid, currentBand: "6.5", targetBand: "3.5" }).success).toBe(false);
  });

  it("rejects an invalid student email (AC-1.4)", () => {
    expect(roadmapRequestSchema.safeParse({ ...valid, studentEmail: "not-an-email" }).success).toBe(false);
  });

  it("rejects a missing student name (AC-1.3)", () => {
    expect(roadmapRequestSchema.safeParse({ ...valid, studentName: "" }).success).toBe(false);
  });

  it("rejects an invalid audience enum", () => {
    expect(roadmapRequestSchema.safeParse({ ...valid, audience: "OTHER" }).success).toBe(false);
  });
});
