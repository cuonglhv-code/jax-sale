import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

const MEDICAL_BUCKET = "medical-documents";

/**
 * US7 (T059, contracts/notifications.md — R7; data-model §7 FR-033a): sweep
 * `request_attachment WHERE purge_after < today`, delete the storage object FIRST then the metadata
 * row (research R7's explicit ordering — never the reverse, to avoid an orphaned inaccessible
 * object outliving its own deletion record), and audit each purge.
 *
 * ⚠ Deviation note (documented per this task's instructions): nothing in the codebase currently
 * POPULATES `purge_after` — `uploadAttachmentCore` (attachment.service.ts, US6/T053) inserts a
 * `request_attachment` row without ever setting it, and no other code path does either. This sweep
 * is therefore CORRECTLY a no-op today (it will find zero rows) until a `purge_after`-STAMPING
 * mechanism exists — data-model.md FR-033a describes stamping it "when a request record becomes
 * non-live (approved-and-elapsed / rejected / cancelled)" against `leave_policy_config
 * .medical_doc_retention_days", which is its own piece of work (arguably Polish-phase scope, per
 * T054's own comment: "purge_after/cron auto-purge is T063, Polish phase — not part of this
 * story's scope"). Building that stamping mechanism is out of scope for US7 (T059 only asks for the
 * sweep route itself) — NOT invented here to avoid scope creep beyond this task.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!expected || authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: dueRows, error } = await supabase
    .from("request_attachment")
    .select("id, storage_path, request_id")
    .lt("purge_after", today);
  if (error) {
    console.error("[cron/purge-documents] failed to read due attachments", error);
    return NextResponse.json({ error: "Failed to read due attachments" }, { status: 500 });
  }

  let purged = 0;
  for (const row of dueRows ?? []) {
    const storagePath = row.storage_path as string;
    const { error: removeError } = await supabase.storage.from(MEDICAL_BUCKET).remove([storagePath]);
    if (removeError) {
      // Idempotent retry: log and skip this row's metadata deletion — a future run will retry the
      // same storage removal (never delete the metadata row before the object is gone, per R7).
      console.error(`[cron/purge-documents] failed to remove object ${storagePath}`, removeError);
      continue;
    }

    const { error: deleteError } = await supabase.from("request_attachment").delete().eq("id", row.id);
    if (deleteError) {
      console.error(`[cron/purge-documents] object removed but metadata delete failed for ${row.id}`, deleteError);
      continue;
    }

    // `write_audit_log`'s RPC reads `auth.jwt() ->> 'employee_id'/'centre_id'` — there is no JWT in
    // a cron (service-role) context, and `audit_log.actor_id`/`centre_id` are NOT NULL FKs with no
    // "system actor" row in this schema, so calling the RPC here would insert NULLs and violate the
    // constraint. Insert directly instead, resolving the owning request's submitter/centre as the
    // best available attribution for a system-initiated action on that request (documented
    // deviation — a dedicated system-actor employee row is out of scope for this task).
    const { data: owningRequest } = await supabase
      .from("hr_request")
      .select("submitter_id, centre_id")
      .eq("id", row.request_id as string)
      .maybeSingle();
    if (owningRequest) {
      const { error: auditError } = await supabase.from("audit_log").insert({
        actor_id: owningRequest.submitter_id,
        action: "attachment.purge",
        entity_type: "hr_request",
        entity_id: row.request_id as string,
        centre_id: owningRequest.centre_id,
        metadata: { system: true, reason: "purge_after elapsed" },
      });
      if (auditError) console.error("[audit] attachment.purge failed to log", auditError);
    }

    purged += 1;
  }

  return NextResponse.json({ purged });
}
