import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  withError,
  UnauthenticatedError,
  ForbiddenError,
  DomainError,
} from "@/lib/server-action";

/**
 * Polish (coverage gap close): every `withError` error-classification branch (constitution
 * Principle III / FR-025) — friendly Vietnamese message per error type, discriminated result
 * shape, and the happy path.
 */
describe("server-action: withError", () => {
  it("returns { data } on success", async () => {
    const result = await withError(async () => 42);
    expect(result).toEqual({ data: 42 });
  });

  it("maps UnauthenticatedError to a friendly message", async () => {
    const result = await withError(async () => {
      throw new UnauthenticatedError();
    });
    expect("error" in result && result.error).toBe("Vui lòng đăng nhập để tiếp tục.");
  });

  it("maps ForbiddenError to a friendly message", async () => {
    const result = await withError(async () => {
      throw new ForbiddenError();
    });
    expect("error" in result && result.error).toBe("Bạn không có quyền thực hiện thao tác này.");
  });

  it("maps a ZodError to a validation message", async () => {
    const schema = z.object({ email: z.string().email() });
    const result = await withError(async () => {
      schema.parse({ email: "not-an-email" });
      return null;
    });
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error).toContain("không hợp lệ");
  });

  it("surfaces a DomainError's own user-safe message directly", async () => {
    const result = await withError(async () => {
      throw new DomainError("Không tìm thấy công việc");
    });
    expect("error" in result && result.error).toBe("Không tìm thấy công việc");
  });

  it("maps an unrecognized error to the generic fallback message", async () => {
    const result = await withError(async () => {
      throw new Error("some internal detail");
    });
    expect("error" in result).toBe(true);
    expect((result as { error: string }).error.length).toBeGreaterThan(0);
  });
});
