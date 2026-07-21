/** Two-letter initials from the last two words of a name — shared by any UI that renders an
 *  avatar chip (Task board, Daily Work view). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts.at(-2)?.[0] ?? "") + (parts.at(-1)?.[0] ?? "")).toUpperCase();
}
