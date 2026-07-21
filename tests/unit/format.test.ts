import { describe, it, expect } from "vitest";
import { initials } from "@/lib/format";

describe("format: initials", () => {
  it("returns the first letter of the last two words, uppercased", () => {
    expect(initials("Nguyễn Văn A")).toBe("VA");
  });

  it("handles a two-word name", () => {
    expect(initials("Trần Hùng")).toBe("TH");
  });

  it("handles a single-word name by taking just its first letter", () => {
    expect(initials("Admin")).toBe("A");
  });
});
