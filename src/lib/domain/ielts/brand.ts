/**
 * Brand tokens (spec §Brand; plan Brand Token Table). Single source for the PDF's palette, fonts,
 * footer, and asset paths. Content/config data — no logic.
 *
 * ⚠ Diacritic-safety rule (research D-PDF): all diacritic-bearing Vietnamese text MUST use
 * `font.body` (Montserrat — verified Vietnamese coverage). `font.display` (Sansita) is for
 * ASCII-safe brand strings ONLY (e.g. the footer "Jaxtina – IELTS Made SIMPLE").
 *
 * ⚠ Brand assets (logo, mascot) and the exact brand-font TTFs are supplied by Jaxtina; see
 * src/lib/ielts/pdf/fonts.ts and the /public/ielts asset paths below.
 */

export const BRAND = {
  color: {
    navy: "#2B3A8C",
    red: "#D01F26",
    ink: "#1A1A1A",
    muted: "#666666",
    paper: "#FFFFFF",
  },
  font: {
    body: "Montserrat", // diacritic-bearing Vietnamese text
    display: "Sansita", // ASCII-safe brand strings only
  },
  footer: {
    text: "Jaxtina – IELTS Made SIMPLE",
  },
  asset: {
    // Single Jaxtina logo used for ALL brand-image slots (logo + mascot). Drop the PNG here:
    //   public/ielts/jaxtina-logo.png
    logo: "/ielts/jaxtina-logo.png",
    /** Brand mascot (schoolgirl climber) — used deliberately as the climb marker, never
     *  decoratively (constitution VIII). Drop the PNG at public/brand/mascot-climber.png. */
    mascotClimber: "/brand/mascot-climber.png",
    /** Sansita tagline lockup, pre-rendered SVG (research D-FONT — the tagline is ASCII-only;
     *  no Vietnamese glyph ever renders in Sansita). Drop at public/brand/tagline-lockup.svg. */
    taglineLockup: "/brand/tagline-lockup.svg",
  },
  /** Summit mountain scene palette (005 T003) — atmosphere layers, bottom (warm base) to top
   *  (thin summit light). Derived from the navy/red identity; NOT the Olympia palette. */
  mountain: {
    skyTop: "#1B2660",
    skyMid: "#2B3A8C",
    skyBase: "#46549E",
    slopeLit: "#F5F6FB",
    slopeDim: "#B9C0DD",
    pathLit: "#D01F26",
    pathDim: "#8A93BC",
    summitGlow: "#FFD9A0",
  },
} as const;
