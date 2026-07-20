import { Font } from "@react-pdf/renderer";
import { BRAND } from "@/lib/domain/ielts/brand";

/**
 * Font registration with the DIACRITIC-SAFETY RULE (research D-PDF, SC-004): all diacritic-bearing
 * Vietnamese text uses `BRAND.font.body` (Montserrat — verified Vietnamese coverage). `font.display`
 * (Sansita) is reserved for ASCII-safe brand strings only.
 *
 * BROWSER-SAFE BY DESIGN: PDF generation runs CLIENT-SIDE in both 002 and 005 (`pdf(...).toBlob()`
 * inside "use client" components — Constitution V, presentation must work offline). `Font.register`
 * therefore takes a public URL (fetched by @react-pdf at render time, works in both the browser and
 * Node/vitest), never a filesystem path — a prior `node:fs`-based existsSync/readFileSync version
 * resolved fine under Node-only tests but broke the Turbopack CLIENT bundle (`node:fs` has no
 * browser equivalent), a latent bug this feature's build validation (005 T042) surfaced.
 *
 * ⚠ Brand-asset gap: the real Jaxtina Montserrat/Sansita TTFs are supplied by Jaxtina and dropped
 * into `public/ielts/fonts/`. `FONT_ASSETS_PRESENT` is a manual flag (not a filesystem probe, which
 * can't run client-side) — flip it to `true` once those files exist. Until then this is GRACEFUL:
 * registration is skipped and the PDF renders with @react-pdf's default font.
 */
const FONT_ASSETS_PRESENT = false;

let registered = false;
let bodyRegistered = false;
let displayRegistered = false;

/** Register brand fonts once. Returns which families were actually registered (asset-dependent). */
export function registerBrandFonts(): { body: boolean; display: boolean } {
  if (registered) return { body: bodyRegistered, display: displayRegistered };
  registered = true;
  if (!FONT_ASSETS_PRESENT) return { body: false, display: false };

  Font.register({
    family: BRAND.font.body,
    fonts: [
      { src: "/ielts/fonts/Montserrat-Regular.ttf", fontWeight: 400 },
      { src: "/ielts/fonts/Montserrat-Bold.ttf", fontWeight: 700 },
    ],
  });
  Font.register({
    family: BRAND.font.display,
    fonts: [
      { src: "/ielts/fonts/Sansita-Regular.ttf", fontWeight: 400 },
      { src: "/ielts/fonts/Sansita-Bold.ttf", fontWeight: 700 },
    ],
  });
  bodyRegistered = true;
  displayRegistered = true;
  return { body: true, display: true };
}

/**
 * The font a piece of text MUST use. Diacritic-bearing Vietnamese ⇒ body font (never the display
 * font, which may lack Vietnamese glyphs). This encodes the SC-004 guarantee at the API level:
 * callers ask for a role, not a font name, so display can never be applied to diacritic text.
 */
export function fontFor(role: "body" | "brand-ascii"): string | undefined {
  if (role === "brand-ascii" && displayRegistered) return BRAND.font.display;
  return bodyRegistered ? BRAND.font.body : undefined; // undefined ⇒ @react-pdf default
}
