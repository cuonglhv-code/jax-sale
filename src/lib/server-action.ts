/**
 * The canonical mutation-pipeline wrapper (constitution Principle III, spec FR-024d/FR-025).
 * Every mutating server action runs as:
 *   withError(() => { assertPermission(key); const input = schema.parse(raw); return service(...) })
 * `withError` catches ZodError/Error and returns a discriminated `{ data } | { error }` with a
 * friendly Vietnamese message in production and raw detail in development. Errors are never
 * silently swallowed — full detail is logged server-side.
 */

import { ZodError } from "zod";

export class UnauthenticatedError extends Error {
  constructor(message = "Chưa đăng nhập") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Không có quyền") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Domain-level rejection with a user-safe Vietnamese message (e.g. cross-centre assignment). */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export type ActionResult<T> = { data: T } | { error: string };

const isDev = process.env.NODE_ENV !== "production";

function friendlyMessage(err: unknown): string {
  if (err instanceof UnauthenticatedError) return "Vui lòng đăng nhập để tiếp tục.";
  if (err instanceof ForbiddenError) return "Bạn không có quyền thực hiện thao tác này.";
  if (err instanceof ZodError) {
    // Validation errors are user-facing: surface the first issue's message (already Vietnamese
    // when the schema supplies one) in dev; a generic message in prod.
    return isDev ? `Dữ liệu không hợp lệ: ${err.issues[0]?.message ?? ""}` : "Dữ liệu không hợp lệ.";
  }
  // DomainError messages are authored to be user-safe Vietnamese, so surface them directly.
  if (err instanceof DomainError) return err.message;
  return isDev && err instanceof Error
    ? `Đã xảy ra lỗi: ${err.message}`
    : "Đã xảy ra lỗi. Vui lòng thử lại.";
}

/** Wrap a mutating action body; returns a discriminated result and logs full detail server-side. */
export async function withError<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { data: await fn() };
  } catch (err) {
    // Log full detail server-side (never swallow); users see only the friendly message.
    console.error("[action error]", err);
    return { error: friendlyMessage(err) };
  }
}
