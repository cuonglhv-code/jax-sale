/**
 * The form-definition registry — the HR "engine" (slice #004, data-model §10). One `FormDefinition`
 * per RequestType makes the submission pipeline a single code path: pick the definition by type →
 * `schema.parse` → type-specific rules → atomic create RPC. Adding a tenth form = adding one entry,
 * no new pipeline (FR-002).
 *
 * `annual_leave`/`shift_swap` registered in US1/US4; the remaining seven register here in US5
 * (T046/T047).
 */

import { z } from "zod";
import { LEAVE_DAY_PARTS, PERSONAL_LEAVE_EVENTS, REQUEST_TYPES, type RequestType } from "@/lib/data/types";
import { annualLeaveSchema, type AnnualLeaveInput } from "@/schemas/hr/submit";
import { shiftSwapSchema, type ShiftSwapInput } from "@/schemas/hr/shift-swap";
import { sickLeaveSchema, type SickLeaveInput } from "@/schemas/hr/sick-leave";
import { personalLeaveSchema, type PersonalLeaveInput } from "@/schemas/hr/personal-leave";
import { unpaidLeaveSchema, type UnpaidLeaveInput } from "@/schemas/hr/unpaid-leave";
import { overtimeSchema, type OvertimeInput } from "@/schemas/hr/overtime";
import { salaryAdvanceSchema, type SalaryAdvanceInput } from "@/schemas/hr/salary-advance";
import { purchaseSchema, type PurchaseInput } from "@/schemas/hr/purchase";
import { businessTravelSchema, type BusinessTravelInput } from "@/schemas/hr/business-travel";

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

// ── shift_swap (US4, T044) ──────────────────────────────────────────────────────
HR_FORM_REGISTRY.shift_swap = {
  type: "shift_swap",
  fields: [
    { name: "note", kind: "textarea", labelKey: "hr.shiftSwap.note" },
    // The class/session/nominee fields are rendered by a dedicated cover-picker widget, not the
    // generic field renderer (T049, US5) — omitted from `fields` here; see AnnualLeaveForm's inline
    // cover-picker pattern for the v1 shape shift_swap's UI reuses.
  ],
  schema: shiftSwapSchema,
  requiresDocument: false,
  isMoneyForm: false,
  sideEffect: "none",
  // Standalone use of the cover mechanism (FR-021) — no leave date range; the submitter directly
  // names the one class/session/nominee to swap into (see resolveRequiredCovers's shift_swap branch
  // in hr-request.service.ts).
  conflictScoped: true,
};

// ── sick_leave (US5, T047) ──────────────────────────────────────────────────────
HR_FORM_REGISTRY.sick_leave = {
  type: "sick_leave",
  fields: [
    { name: "startDate", kind: "date", labelKey: "hr.sickLeave.startDate", required: true },
    { name: "endDate", kind: "date", labelKey: "hr.sickLeave.endDate", required: true },
    { name: "dayPart", kind: "select", labelKey: "hr.sickLeave.dayPart", options: LEAVE_DAY_PARTS },
  ],
  schema: sickLeaveSchema,
  // Medical documentation is statutorily required for sick leave (FR-031); the upload UI/storage
  // itself is US6 — this flag only records that the submission NEEDS one for US6 to build on.
  requiresDocument: true,
  isMoneyForm: false,
  sideEffect: "none", // FR-007/FR-014: sick leave never draws the annual-leave balance.
  conflictScoped: true, // Same leave-family cover requirement as annual_leave.
};

// ── personal_leave (US5, T047) ──────────────────────────────────────────────────
HR_FORM_REGISTRY.personal_leave = {
  type: "personal_leave",
  fields: [
    { name: "startDate", kind: "date", labelKey: "hr.personalLeave.startDate", required: true },
    { name: "endDate", kind: "date", labelKey: "hr.personalLeave.endDate", required: true },
    { name: "dayPart", kind: "select", labelKey: "hr.personalLeave.dayPart", options: LEAVE_DAY_PARTS },
    { name: "event", kind: "select", labelKey: "hr.personalLeave.event", options: PERSONAL_LEAVE_EVENTS, required: true },
    { name: "reason", kind: "textarea", labelKey: "hr.personalLeave.reason" },
  ],
  schema: personalLeaveSchema,
  // Statutory paid-personal-leave events (marriage_self/marriage_child/bereavement) are backed by a
  // leave_event_allowance config row (data-model §3, seed.sql) — real-world equivalents (marriage
  // certificate, death certificate) are the norm for claiming the statutory allowance, so those
  // three events require documentation. `other` is the unpaid-by-agreement path (seed: 0 days,
  // unpaid) with no statutory allowance to substantiate, so no document is required.
  requiresDocument: (payload) => payload.event !== "other",
  isMoneyForm: false,
  sideEffect: "none", // FR-007/FR-014: personal leave never draws the annual-leave balance.
  conflictScoped: true,
};

// ── unpaid_leave (US5, T047) ─────────────────────────────────────────────────────
HR_FORM_REGISTRY.unpaid_leave = {
  type: "unpaid_leave",
  fields: [
    { name: "startDate", kind: "date", labelKey: "hr.unpaidLeave.startDate", required: true },
    { name: "endDate", kind: "date", labelKey: "hr.unpaidLeave.endDate", required: true },
    { name: "dayPart", kind: "select", labelKey: "hr.unpaidLeave.dayPart", options: LEAVE_DAY_PARTS },
    { name: "reason", kind: "textarea", labelKey: "hr.unpaidLeave.reason" },
  ],
  schema: unpaidLeaveSchema,
  requiresDocument: false,
  isMoneyForm: false,
  sideEffect: "none", // FR-007/FR-014: unpaid leave never draws the annual-leave balance.
  conflictScoped: true,
};

// ── overtime (US5, T047) ─────────────────────────────────────────────────────────
HR_FORM_REGISTRY.overtime = {
  type: "overtime",
  fields: [
    { name: "date", kind: "date", labelKey: "hr.overtime.date", required: true },
    { name: "hours", kind: "number", labelKey: "hr.overtime.hours", required: true },
    { name: "justification", kind: "textarea", labelKey: "hr.overtime.justification", required: true },
  ],
  schema: overtimeSchema,
  requiresDocument: false,
  isMoneyForm: false,
  sideEffect: "none",
  // Not an absence from teaching — no cover is ever required, even on a date the submitter teaches.
  conflictScoped: false,
};

// ── salary_advance (US5, T047) ────────────────────────────────────────────────────
HR_FORM_REGISTRY.salary_advance = {
  type: "salary_advance",
  fields: [
    { name: "amount", kind: "number", labelKey: "hr.salaryAdvance.amount", required: true },
    { name: "repaymentIntent", kind: "textarea", labelKey: "hr.salaryAdvance.repaymentIntent", required: true },
  ],
  schema: salaryAdvanceSchema,
  requiresDocument: false,
  isMoneyForm: true, // Notifies accounting on approval (FR-025) — hook in decideRequestCore (T048).
  sideEffect: "none",
  conflictScoped: false,
};

// ── purchase (US5, T047) ──────────────────────────────────────────────────────────
HR_FORM_REGISTRY.purchase = {
  type: "purchase",
  fields: [
    { name: "amount", kind: "number", labelKey: "hr.purchase.amount", required: true },
    { name: "item", kind: "text", labelKey: "hr.purchase.item", required: true },
    { name: "vendor", kind: "text", labelKey: "hr.purchase.vendor" },
    { name: "justification", kind: "textarea", labelKey: "hr.purchase.justification", required: true },
  ],
  schema: purchaseSchema,
  requiresDocument: false,
  isMoneyForm: true,
  sideEffect: "none",
  conflictScoped: false,
};

// ── business_travel (US5, T047) ───────────────────────────────────────────────────
HR_FORM_REGISTRY.business_travel = {
  type: "business_travel",
  fields: [
    { name: "startDate", kind: "date", labelKey: "hr.businessTravel.startDate", required: true },
    { name: "endDate", kind: "date", labelKey: "hr.businessTravel.endDate", required: true },
    { name: "amount", kind: "number", labelKey: "hr.businessTravel.amount", required: true },
    { name: "destination", kind: "text", labelKey: "hr.businessTravel.destination", required: true },
    { name: "justification", kind: "textarea", labelKey: "hr.businessTravel.justification", required: true },
  ],
  schema: businessTravelSchema,
  requiresDocument: false,
  isMoneyForm: true,
  sideEffect: "none",
  // data-model §10 engine table lists business_travel's Conflict column as "no" — travel is not an
  // absence-from-teaching in the cover mechanism's sense, so the resolver never runs for it despite
  // it carrying a date range.
  conflictScoped: false,
};

const requestTypeEnvelopeSchema = z.object({
  requestType: z.enum(REQUEST_TYPES, { message: "Loại yêu cầu không hợp lệ" }),
});

/** The union of every registered submit input shape (all nine types, US1+US4+US5). */
export type SubmitInput =
  | AnnualLeaveInput
  | ShiftSwapInput
  | SickLeaveInput
  | PersonalLeaveInput
  | UnpaidLeaveInput
  | OvertimeInput
  | SalaryAdvanceInput
  | PurchaseInput
  | BusinessTravelInput;

/**
 * Dispatch raw submit input to the registered type's schema. Single dispatch point so adding a form
 * type never grows a parallel per-type switch elsewhere (FR-002).
 */
export function parseSubmitInput(raw: unknown): SubmitInput {
  const { requestType } = requestTypeEnvelopeSchema.parse(raw);
  const definition = getFormDefinition(requestType);
  return definition.schema.parse(raw) as SubmitInput;
}
