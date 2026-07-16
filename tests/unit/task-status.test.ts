import { describe, it, expect } from "vitest";
import { nextAutoStatus, resolveTargetStatus } from "@/services/task-status";

/**
 * US4 (T044): pure transition matrix — auto-cycle order + explicit-only states; auto never
 * enters/leaves BLOCK (FR-020).
 */
describe("task-status: transition matrix", () => {
  it("cycles TODO -> DOING -> DONE -> TODO automatically", () => {
    expect(nextAutoStatus("TODO")).toBe("DOING");
    expect(nextAutoStatus("DOING")).toBe("DONE");
    expect(nextAutoStatus("DONE")).toBe("TODO");
  });

  it("has no automatic exit from BLOCK, RESCHEDULED, or CANCELLED", () => {
    expect(nextAutoStatus("BLOCK")).toBeNull();
    expect(nextAutoStatus("RESCHEDULED")).toBeNull();
    expect(nextAutoStatus("CANCELLED")).toBeNull();
  });

  it("resolveTargetStatus follows the auto-cycle when no target is named", () => {
    expect(resolveTargetStatus("TODO")).toBe("DOING");
    expect(resolveTargetStatus("DONE")).toBe("TODO");
  });

  it("resolveTargetStatus throws when auto-cycling from an explicit-only state", () => {
    expect(() => resolveTargetStatus("BLOCK")).toThrow();
  });

  it("resolveTargetStatus allows any explicit target, including entering/leaving BLOCK", () => {
    expect(resolveTargetStatus("DOING", "BLOCK")).toBe("BLOCK");
    expect(resolveTargetStatus("BLOCK", "TODO")).toBe("TODO");
  });
});
