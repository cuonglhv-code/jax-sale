/**
 * T018 — Placement is a structural barrier (Constitution III), mirroring the compile-time
 * pattern already proven for `StudentRoadmapView` in internal-warning-barrier.test.ts. There is
 * no separately-settable boolean or optional prop anywhere in the render path: every consumer
 * takes a real `Placement` and calls `provisionalTreatmentFor`, whose `default: assertNever`
 * branch makes an unhandled third variant a COMPILE ERROR, not a runtime bypass.
 */

import { describe, it, expect } from "vitest";
import { provisionalTreatmentFor } from "@/services/ielts/placement-view";
import type { Placement } from "@/services/ielts/summit-types";

// Compile-time barrier: Placement has EXACTLY the two documented variant kinds. If a third
// variant were added without updating this union, `ExtraKinds` would be non-never and the
// assignment below would fail `tsc --noEmit`.
type PlacementKind = Placement["kind"];
type ExtraKinds = Exclude<PlacementKind, "measured" | "estimated">;
const _noExtraKinds: ExtraKinds extends never ? true : false = true;

// And both documented kinds are actually present (so the union isn't accidentally narrowed).
type HasMeasured = "measured" extends PlacementKind ? true : false;
type HasEstimated = "estimated" extends PlacementKind ? true : false;
const _hasMeasured: HasMeasured = true;
const _hasEstimated: HasEstimated = true;

describe("Placement structural barrier", () => {
  it("type-level barrier holds (exactly two variants, both present)", () => {
    expect(_noExtraKinds).toBe(true);
    expect(_hasMeasured).toBe(true);
    expect(_hasEstimated).toBe(true);
  });

  it("every known Placement value is handled — no variant silently produces no result", () => {
    const values: Placement[] = [
      { kind: "measured", testDate: null },
      { kind: "measured", testDate: "2026-07-15" },
      { kind: "estimated" },
    ];
    for (const v of values) {
      // Runtime proof the function terminates without throwing for every known shape —
      // an unhandled variant would hit `assertNever` and throw, failing this loop.
      expect(() => provisionalTreatmentFor(v)).not.toThrow();
    }
  });

  it("an unrecognized kind at runtime throws via assertNever rather than rendering silently", () => {
    const bogus = { kind: "guessed" } as unknown as Placement;
    expect(() => provisionalTreatmentFor(bogus)).toThrow(/Unhandled variant/);
  });
});
