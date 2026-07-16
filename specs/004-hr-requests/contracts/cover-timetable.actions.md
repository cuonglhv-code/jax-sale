# Contract: Timetable & Conflict Resolver

Covers the minimal class timetable and the conflict/cover mechanism. Same canonical pipeline.

## upsertClass — `upsert-class.ts` (key: `timetable.manage`; centre_admin, centre_manager, super_admin)

**Input** (`schemas/hr/class.ts`): `{ id?, courseLabel, teacherId, weekday(1–7), startTime, endTime,
startDate, endDate, isActive }`.

**Service `upsertClassCore`** → `upsert_class(...)` (guarded): asserts `teacherId` is an **active
teacher of the caller's own centre** (same-centre guard, mirrors `assign_task`); `centre_id` from claims,
never input. history-free (reference data) but `write_audit_log("timetable.upsert", "class", id, …)`.
RLS Pattern A (broad read; own-centre write).

**Reads**: `useClasses(centreId?)` — broad read (schedules not sensitive), paginated.

---

## Conflict resolver (pure — `lib/hr/conflict.ts`)

Signature: `resolveAffectedSessions(classes, teacherId, range, dayPart, holidays, workingWeek) →
AffectedSession[]` where `AffectedSession = { classId, sessionDate, startTime, endTime }`.

Algorithm (no DB writes; operates on rows fetched by the caller):
```
for each active class where teacher_id == teacherId and centre matches:
  for each date D in [range.start, range.end]:
    if isoWeekday(D) == class.weekday
       and D within [class.start_date, class.end_date]
       and D not in holidays
       and dayPart overlaps [class.start_time, class.end_time]:   // full | morning | afternoon
      emit { classId, sessionDate: D, startTime, endTime }
```
- `dayPart` overlap: `full` → all sessions that day; `morning`/`afternoon` → only sessions whose slot
  falls in that half (AM/PM boundary is a config value — R3 caveat).
- Used at **submission** to require covers, and reused to detect a **nominee's own** conflict (call with
  the nominee id; any emitted session ⇒ hard conflict ⇒ block nomination, FR-020).
- Pure and unit-tested (Principle IV; `tests/unit/hr/conflict.test.ts`): overlapping ranges, holiday
  exclusion, half-day AM/PM, class recurrence-window edges, inactive classes.

---

## nominateCover (part of submitRequest) & respondCover

Nomination is submitted **with** the request (`payload.covers[]`), created atomically in
`create_hr_request_with_log`. Each cover row = `(request_id, class_id, session_date, nominee_id)`. The
submit path validates each nominee is a same-centre active teacher with **no** hard conflict at that
session (else `DomainError`). `respondCover` is documented in
[hr-requests.actions.md](./hr-requests.actions.md).

**Reads**: `useMyCoverNominations()` — `nominee_id = me AND status = nominated`, so a teacher sees cover
requests awaiting their accept/decline (feeds the notification's in-app counterpart).
