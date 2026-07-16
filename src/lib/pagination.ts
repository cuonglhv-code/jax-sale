/**
 * Pagination primitives (constitution §8, spec FR-026/SC-008a). Every list returns `Paginated<T>`;
 * no unbounded queries. `toRange` bridges a 1-based page to the DB client's inclusive range API.
 */

export interface Paginated<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/** Clamp a requested page size into [1, MAX_PAGE_SIZE], defaulting when absent. */
export function resolvePageSize(pageSize?: number): number {
  if (!pageSize || pageSize < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(pageSize, MAX_PAGE_SIZE);
}

/** 1-based page → inclusive `[from, to]` row range (as used by the DB range API). */
export function toRange(page: number, pageSize: number): { from: number; to: number } {
  const p = Math.max(1, page);
  const size = Math.max(1, pageSize);
  const from = (p - 1) * size;
  return { from, to: from + size - 1 };
}
