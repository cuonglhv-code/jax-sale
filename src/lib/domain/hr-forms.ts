/**
 * The form-definition registry — the HR "engine" (slice #004, data-model §10). One `FormDefinition`
 * per RequestType makes the submission pipeline a single code path: pick the definition by type →
 * `schema.parse` → type-specific rules → atomic create RPC. Adding a tenth form = adding one entry,
 * no new pipeline (FR-002).
 *
 * SCAFFOLD ONLY: the per-type definitions (fields + Zod schema + side effects) are registered in
 * US1 (annual_leave) and US5 (the remaining eight). This file ships the types and an empty registry
 * so downstream code can depend on the shape now.
 */

import { z } from "zod";
import type { RequestType } from "@/lib/data/types";

/** Renderable field kinds for the schema-driven form renderer. */
export type FieldKind = "text" | "textarea" | "date" | "number" | "select" | "file";

/** A single field descriptor; the display label is resolved via vocabulary.ts, never hardcoded. */
export interface FieldDef {
  /** payload/promoted-column key this field binds to. */
  name: string;
  kind: FieldKind;
  /** Vocabulary label key for the field caption. */
  labelKey: string;
  required?: boolean;
  /** Option values for `select` kinds (labels resolved via vocabulary.ts). */
  options?: readonly string[];
}

/** The annual-leave balance draw is the only side effect in this slice (data-model §10). */
export type FormSideEffect = "draw_annual_balance" | "none";

/** Whether a document is required — static, or a predicate over the parsed payload (e.g. by event). */
export type RequiresDocument = boolean | ((payload: Record<string, unknown>) => boolean);

/** One entry per RequestType — the whole contract the submission pipeline reads (data-model §10). */
export interface FormDefinition {
  type: RequestType;
  /** Fields rendered dynamically for this type. */
  fields: readonly FieldDef[];
  /** Boundary validation for the payload + promoted columns. */
  schema: z.ZodType;
  /** Sick = true; personal = by event; others = false. */
  requiresDocument: RequiresDocument;
  /** salary_advance | purchase | business_travel ⇒ notify accounting on approval. */
  isMoneyForm: boolean;
  /** Only annual_leave draws the balance. */
  sideEffect: FormSideEffect;
  /** Leave-family + shift_swap ⇒ run the class-conflict resolver. */
  conflictScoped: boolean;
}

/**
 * The registry, keyed by RequestType. Empty until US1/US5 register definitions — `Partial` because
 * not every type is registered yet.
 */
export const HR_FORM_REGISTRY: Partial<Record<RequestType, FormDefinition>> = {};

/** Look up a registered form definition, throwing a clear error if the type is not yet registered. */
export function getFormDefinition(type: RequestType): FormDefinition {
  const definition = HR_FORM_REGISTRY[type];
  if (!definition) throw new Error(`Chưa đăng ký loại yêu cầu: ${type}`);
  return definition;
}
