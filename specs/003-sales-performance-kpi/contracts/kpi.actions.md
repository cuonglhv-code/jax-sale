# Contract: Server Actions (`src/app/actions/kpi/*`)

Every mutation runs the canonical pipeline `withError(() => { assertPermission(key); const input =
schema.parse(raw); return service(client, input, claims) })` and emits an `audit_log` entry on the
sensitive write. Reads use `assertAuthenticated` + tiered RLS. Results are `ActionResult<T>` =
`{ data } | { error }` (Vietnamese messages).

## Mutations

| Action | Permission key | Zod input | Service | Audit action |
|---|---|---|---|---|
| `recordActual` | `personalKpi.recordActual` | `{ period, metricKey, actual }` | upsert own row's `actual` (INSERT seeds `pending` + `null→pending` log; UPDATE via trigger → `pending`) | `personalKpi.recordActual` / `...editActual` |
| `approveActual` | `personalKpi.approveActual` | `{ entryId }` | `rpc('approve_personal_kpi', {p_entry_id})` | `personalKpi.approveActual` |
| `rejectActual` | `personalKpi.approveActual` | `{ entryId, note? }` | `rpc('reject_personal_kpi', {p_entry_id, p_note})` | `personalKpi.rejectActual` |
| `setPersonalTarget` | `personalKpi.setTarget` | `{ consultantId, period, metricKey, target\|null }` | upsert `target` on the centre's row (trigger forbids `actual` write) | `personalKpi.setTarget` / `...clearTarget` |
| `setDepartmentTarget` | `departmentKpi.setTarget` | `{ departmentId, period, metricKey, target\|null }` | upsert/delete `department_kpi_targets` (Pattern-B RLS) | `departmentKpi.setTarget` / `...clearTarget` |

- `recordActual` resolves `consultant_id = claims.employeeId` and `centre_id = claims.centreId`
  server-side — never from the client (constitution II).
- `setPersonalTarget` is centre-narrow via RLS; a manager cannot target a consultant of another
  centre (rejected at DB).
- `target: null` clears the target (→ `not_set`); `target ≤ 0` rejected by Zod (D-ZERO).
- Audit metadata records changed fields (not values, for updates) per constitution III.

## Reads

| Action | Auth | Returns |
|---|---|---|
| `getMyPerformance` | `assertAuthenticated` (sale_consultant) | own `PersonalKpiEntry[]` + derived `Attainment[]` for a period; own approval states |
| `getDashboard` | `assertAuthenticated` | `rpc('kpi_dashboard', {p_period})` → tier-scoped `KpiDashboardRow[]` (approved-only) |
| `getLeaderboard` | `assertAuthenticated` (manager/admin; consultants get 403 / no surface — AC-4.3) | `rpc('kpi_leaderboard', {p_period, p_metric})` ranked, tier-scoped |
| `listPendingApprovals` | `assertAuthenticated` (manager/admin) | own-centre `personal_kpis` where `approval_status = 'pending'` (paginated) |
| `exportReport` | `assertAuthenticated` (manager/admin) | `{ csv: string, pdf: Uint8Array }` from the caller's tier rows (AC-5.2) |

- All lists paginated (`Paginated<T>` from `pagination.ts`); no unbounded queries.
- `getLeaderboard`/`exportReport` for a `sale_consultant` are not exposed (nav hides them; the action
  also gates), enforcing "consultant sees own only, no leaderboard" (AC-4.3, D-TEACHER analog).

## Zod schemas (`src/schemas/kpi.ts`) — validation at the boundary

```ts
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Kỳ không hợp lệ (YYYY-MM)");
const metricKey = z.enum(METRIC_KEYS);
const positiveTarget = z.number().int().positive("Mục tiêu phải lớn hơn 0");  // D-ZERO

export const recordActualInput = z.object({
  period, metricKey, actual: z.number().int().min(0, "Kết quả không được âm"),
});
export const setPersonalTargetInput = z.object({
  consultantId: z.string().uuid(), period, metricKey, target: positiveTarget.nullable(),
});
export const setDepartmentTargetInput = z.object({
  departmentId: z.string().uuid(), period, metricKey, target: positiveTarget.nullable(),
});
export const approveInput = z.object({ entryId: z.string().uuid() });
export const rejectInput = z.object({ entryId: z.string().uuid(), note: z.string().max(500).optional() });
```
