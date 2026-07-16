import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Font } from "@react-pdf/renderer";
import { BRAND } from "@/lib/domain/ielts/brand";

/**
 * Font registration with the DIACRITIC-SAFETY RULE (research D-PDF, SC-004): all diacritic-bearing
 * Vietnamese text uses `BRAND.font.body` (Montserrat — verified Vietnamese coverage). `font.display`
 * (Sansita) is reserved for ASCII-safe brand strings only.
 *
 * ⚠ Brand-asset gap: the real Jaxtina Montserrat/Sansita TTFs are supplied by Jaxtina and dropped
 * into this directory. Registration is GRACEFUL — if a TTF is absent, we skip it (the PDF still
 * renders with @react-pdf's default font). The diacritic guarantee is fully verified once the real
 * Montserrat TTF is present; the structural rule (this module) is already in place.
 */

let registered = false;

function fontDir(): string {
  // In tests/server this file resolves relative to source; fonts live alongside it.
  const here = dirname(fileURLToPath(import.meta.url));
  return here;
}

function registerIfPresent(family: string, files: { regular: string; bold?: string }): boolean {
  const dir = fontDir();
  const regularPath = join(dir, "fonts", files.regular);
  if (!existsSync(regularPath)) return false;
  const sources = [{ src: regularPath, fontWeight: 400 as const }];
  if (files.bold) {
    const boldPath = join(dir, "fonts", files.bold);
    if (existsSync(boldPath)) sources.push({ src: boldPath, fontWeight: 700 as never });
  }
  Font.register({ family, fonts: sources });
  return true;
}

/** Register brand fonts once. Returns which families were actually registered (asset-dependent). */
export function registerBrandFonts(): { body: boolean; display: boolean } {
  if (registered) return { body: bodyRegistered, display: displayRegistered };
  bodyRegistered = registerIfPresent(BRAND.font.body, {
    regular: "Montserrat-Regular.ttf",
    bold: "Montserrat-Bold.ttf",
  });
  displayRegistered = registerIfPresent(BRAND.font.display, {
    regular: "Sansita-Regular.ttf",
    bold: "Sansita-Bold.ttf",
  });
  registered = true;
  return { body: bodyRegistered, display: displayRegistered };
}

let bodyRegistered = false;
let displayRegistered = false;

/**
 * The font a piece of text MUST use. Diacritic-bearing Vietnamese ⇒ body font (never the display
 * font, which may lack Vietnamese glyphs). This encodes the SC-004 guarantee at the API level:
 * callers ask for a role, not a font name, so display can never be applied to diacritic text.
 */
export function fontFor(role: "body" | "brand-ascii"): string | undefined {
  if (role === "brand-ascii" && displayRegistered) return BRAND.font.display;
  return bodyRegistered ? BRAND.font.body : undefined; // undefined ⇒ @react-pdf default
}
