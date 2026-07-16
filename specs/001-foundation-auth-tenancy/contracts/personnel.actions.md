# Contract: Personnel Actions (minimal, this slice)

Only the personnel action needed to exercise the **audit seam** and the **immediate-revocation**
guarantee is in this slice. Full personnel management (invite/allowlist, role assignment scoping) is
deferred to a later slice.

---

## `deactivateEmployee(input)` — mutating, admin
- **Gate**: `assertPermission("employee.deactivate")`.
- **Input** (Zod): `{ employeeId: uuid }`.
- **Behavior**: sets the target employee `is_active = false` **within the caller's own centre**
  (RLS + app check), writes an audit entry `employee.deactivate`, and triggers an **immediate global
  sign-out** of the target (see [auth.actions.md](./auth.actions.md) `forceSignOutEmployee`), so the
  removal of access takes effect on the target's next request (FR-005, FR-007a, SC-003a).
- **Rejects**: deactivating an employee of another centre (cross-centre write refused by RLS,
  FR-013).
- **Success criteria**: FR-005, FR-007a, FR-024g, SC-003a, SC-004a.

---

### Notes
- This is the slice's third sensitive write (alongside `task.create`, `task.assign`) that proves the
  general audit seam (FR-024g) works for a non-Task entity — demonstrating the seam is reusable, not
  Task-specific.
- Scoped role-assignment rules (a `centre_manager` may assign only certain roles) are **out of scope
  here** — deferred to the personnel-management slice.
