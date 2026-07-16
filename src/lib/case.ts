/**
 * Boundary conversion helpers (constitution §8, plan Constraints). App types/schemas are camelCase;
 * DB columns are snake_case. Convert ONLY at the service boundary via these shared helpers — never
 * hand-roll per call. Rows are flat, so shallow key conversion is sufficient.
 */

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}

export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

/** Convert a snake_case DB row into a camelCase app object. */
export function toCamelCase<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[snakeToCamel(k)] = v;
  return out as T;
}

/** Convert a camelCase app object into a snake_case row for the DB. */
export function toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[camelToSnake(k)] = v;
  return out;
}
