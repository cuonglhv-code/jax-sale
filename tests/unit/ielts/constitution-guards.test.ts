/**
 * T040 — Constitution guard rails, enforced as CI-checkable grep gates rather than editorial
 * diligence alone: "Olympia" never appears anywhere in the product (Principle VIII), and summit
 * UI components import their Vietnamese copy from content modules rather than inlining strings
 * (Principle VII).
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import { describe, it, expect } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(here, "../../../src");
const SUMMIT_DIR = resolve(here, "../../../src/app/(app)/lo-trinh-ielts");

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

describe("Constitution VIII: no Olympia identity anywhere (spec FR-028)", () => {
  it("the string 'Olympia' does not appear in any src/ source file", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      const content = readFileSync(file, "utf8");
      if (/olympia/i.test(content)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});

describe("Constitution VII: summit components import copy, never inline Vietnamese JSX text", () => {
  // Heuristic grep, not a full parser: flags a JSX text node containing 2+ consecutive
  // Vietnamese-diacritic words directly between tags (e.g. `>Tổng học phí<`) that is NOT a
  // brace-interpolated expression. False negatives are acceptable (this is a guard, not a
  // formal proof); a true positive means a string slipped in outside summit-copy.ts.
  const DIACRITIC_JSX_TEXT = />[^<{}\n]*[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ][^<{}\n]{3,}</gi;

  // Scoped to the 005 Summit surface. The pre-005 (feature 002) RoadmapBuilder/RoadmapForm/
  // RoadmapReview files still live alongside it (orphaned — page.tsx now renders Summit, not
  // RoadmapBuilder — see plan.md's decision to build alongside rather than mutate 002's files)
  // and are out of THIS feature's task scope to remediate; excluded here, not silently ignored.
  const PRE_005_FILES = ["RoadmapBuilder.tsx", "RoadmapForm.tsx", "RoadmapReview.tsx"];

  it("no summit (005) UI file contains a raw diacritic-bearing JSX text node", () => {
    const offenders: Array<{ file: string; match: string }> = [];
    for (const file of walk(SUMMIT_DIR)) {
      if (file.endsWith("summit-state.ts") || file.endsWith(".test.tsx") || file.endsWith(".test.ts")) continue;
      if (PRE_005_FILES.some((f) => file.endsWith(f))) continue;
      const content = readFileSync(file, "utf8");
      const matches = content.match(DIACRITIC_JSX_TEXT) ?? [];
      for (const m of matches) offenders.push({ file, match: m.trim() });
    }
    expect(offenders).toEqual([]);
  });
});
