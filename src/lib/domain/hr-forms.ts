/**
 * The form-definition registry — the HR "engine" (slice #004, data-model §10). One `FormDefinition`
 * per RequestType makes the submission pipeline a single code path: pick the definition by type →
 * `schema.parse` → type-specific rules → atomic create RPC. Adding a tenth form = adding one entry,
 * no new pipeline (FR-002).
 *
 * `annual_leave` is registered here in US1; the remaining eight register in US5 (T046/T047) — this
 * file ships the types + registry so downstream code can depend on the shape now.
 */

import { z } from "zod";
import { LEAVE_DAY_PARTS, REQUEST_TYPES, type RequestType } from "@/lib/data/types";
import { annualLeaveSchema, type AnnualLeaveInput } from "@/schemas/hr/submit";

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

// ── annual_leave (US1) ─────────────────────────────────────────────────────────
HR_FORM_REGISTRY.annual_leave = {
  type: "annual_leave",
  fields: [
    { name: "startDate", kind: "date", labelKey: "hr.annualLeave.startDate", required: true },
    { name: "endDate", kind: "date", labelKey: "hr.annualLeave.endDate", required: true },
    { name: "dayPart", kind: "select", labelKey: "hr.annualLeave.dayPart", options: LEAVE_DAY_PARTS },
    { name: "note", kind: "textarea", labelKey: "hr.annualLeave.note" },
  ],
  schema: annualLeaveSchema,
  requiresDocument: false,
  isMoneyForm: false,
  sideEffect: "draw_annual_balance",
  // Leave overlapping a taught session needs an accepted cover before approval — the resolver and
  // the cover_assignment rows themselves are US4 (T040/T042); this only marks the type as scoped.
  conflictScoped: true,
};

const requestTypeEnvelopeSchema = z.object({
  requestType: z.enum(REQUEST_TYPES, { message: "Loại yêu cầu không hợp lệ" }),
});

/**
 * Dispatch raw submit input to the registered type's schema (US1: `annual_leave` only — the return
 * type widens to a union once US5 registers the rest). Single dispatch point so adding a form type
 * never grows a parallel per-type switch elsewhere (FR-002).
 */
export function parseSubmitInput(raw: unknown): AnnualLeaveInput {
  const { requestType } = requestTypeEnvelopeSchema.parse(raw);
  const definition = getFormDefinition(requestType);
  return definition.schema.parse(raw) as AnnualLeaveInput;
}
