/**
 * US6 (T053): minimal byte-level MIME sniffing — no dependency added (research R8 ⚠: bucket/client
 * MIME checks only validate the declared `Content-Type`, which the caller controls; a real signature
 * check on the first bytes is the only way to catch a renamed/mislabeled file). Deliberately covers
 * only the three types `doc_type_policy` ever allows (PDF, PNG, JPEG) — no general-purpose file-type
 * library needed for that small, fixed set (YAGNI).
 */

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

function matchesMagic(bytes: Uint8Array, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, i) => bytes[i] === byte);
}

/** The MIME types this sniffer can recognize — the same set `doc_type_policy` ever allows. */
export type SniffedMimeType = "application/pdf" | "image/png" | "image/jpeg";

/** Sniff the REAL content type from magic bytes; null when none of the three known signatures match. */
export function sniffMimeType(bytes: Uint8Array): SniffedMimeType | null {
  if (matchesMagic(bytes, PDF_MAGIC)) return "application/pdf";
  if (matchesMagic(bytes, PNG_MAGIC)) return "image/png";
  if (matchesMagic(bytes, JPEG_MAGIC)) return "image/jpeg";
  return null;
}
