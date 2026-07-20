"use client";

import { useEffect, useState } from "react";
import { useSubmitRequest } from "@/hooks/mutations/hr/useSubmitRequest";
import { useUploadAttachment } from "@/hooks/mutations/hr/useUploadAttachment";
import { useClasses } from "@/hooks/queries/hr/useClasses";
import { listTeachers, type AssignableTeacher } from "@/app/actions/hr/list-teachers";
import { LEAVE_DAY_PARTS, PERSONAL_LEAVE_EVENTS, type LeaveDayPart, type PersonalLeaveEvent } from "@/lib/data/types";
import { LEAVE_DAY_PART_LABEL, PERSONAL_LEAVE_EVENT_LABEL } from "@/lib/domain/vocabulary";
import { DateField, SelectField, Field, FileField } from "@/components/form";

interface LeaveFamilyFormProps {
  requestType: "sick_leave" | "personal_leave" | "unpaid_leave";
}

/**
 * US5 (T049): shared form for the three non-annual leave-family types (sick/personal/unpaid) — same
 * date-range + day-part + cover-picker shape as AnnualLeaveForm (US1/US4), minus the balance display
 * (none of these draw the annual-leave balance, FR-007/FR-014). `personal_leave` additionally shows
 * the statutory event picker (data-model §10); sick leave now includes a required reason field (T047).
 */
export function LeaveFamilyForm({ requestType }: LeaveFamilyFormProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dayPart, setDayPart] = useState<LeaveDayPart>("full");
  const [event, setEvent] = useState<PersonalLeaveEvent>("marriage_self");
  const [reason, setReason] = useState("");
  const [coverClassId, setCoverClassId] = useState("");
  const [coverSessionDate, setCoverSessionDate] = useState("");
  const [coverNomineeId, setCoverNomineeId] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitRequest = useSubmitRequest();
  const uploadAttachment = useUploadAttachment();
  const { data: classes } = useClasses();
  const [teachers, setTeachers] = useState<AssignableTeacher[]>([]);

  // US6 (T054): personal_leave requires documentation for the three statutory events, not for
  // `other` (FormDefinition's own event-conditioned predicate — this UI mirrors it as a nudge,
  // not a hard submit-time block, per the chicken/egg note in hr-forms.ts/attachment.service.ts:
  // the request row must exist before a document can be attached to it, so the file is uploaded
  // as a FOLLOW-UP call after submission succeeds, never blocking the submit itself). sick_leave
  // now uses a text reason field instead (T047) and no longer requires documentation.
  const showsDocumentField = requestType === "personal_leave" && event !== "other";

  useEffect(() => {
    listTeachers().then((result) => {
      if ("data" in result) setTeachers(result.data);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const covers =
        coverClassId && coverSessionDate && coverNomineeId
          ? [{ classId: coverClassId, sessionDate: coverSessionDate, nomineeId: coverNomineeId }]
          : undefined;

      const base = { startDate, endDate, dayPart, covers };
      let created;
      if (requestType === "personal_leave") {
        created = await submitRequest.mutateAsync({ requestType, ...base, event, reason: reason || undefined });
      } else if (requestType === "unpaid_leave") {
        created = await submitRequest.mutateAsync({ requestType, ...base, reason: reason || undefined });
      } else {
        created = await submitRequest.mutateAsync({ requestType, ...base, reason });
      }

      // US6 (T055): the request row must exist before a document can be attached to it (the
      // attachment's request_id foreign key) — upload as a FOLLOW-UP call using the new request's
      // id. A failed upload does not roll back the submit; the user sees the error and can retry
      // the upload separately (the request itself is already safely created).
      if (documentFile) {
        try {
          await uploadAttachment.mutateAsync({ requestId: created.id, file: documentFile });
        } catch (uploadErr) {
          setError(
            `Yêu cầu đã được gửi, nhưng tải tài liệu đính kèm thất bại: ${
              uploadErr instanceof Error ? uploadErr.message : "Đã xảy ra lỗi."
            }`,
          );
          return;
        }
      }

      setStartDate("");
      setEndDate("");
      setDayPart("full");
      setEvent("marriage_self");
      setReason("");
      setCoverClassId("");
      setCoverSessionDate("");
      setCoverNomineeId("");
      setDocumentFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border p-4">
      <DateField label="Ngày bắt đầu" value={startDate} onChange={setStartDate} required />
      <DateField label="Ngày kết thúc" value={endDate} onChange={setEndDate} required min={startDate || undefined} />
      <SelectField
        label="Buổi nghỉ"
        value={dayPart}
        onChange={(v) => setDayPart(v as LeaveDayPart)}
        options={LEAVE_DAY_PARTS.map((p) => ({ value: p, label: LEAVE_DAY_PART_LABEL[p] }))}
      />

      {requestType === "personal_leave" && (
        <SelectField
          label="Lý do nghỉ việc riêng"
          value={event}
          onChange={(v) => setEvent(v as PersonalLeaveEvent)}
          options={PERSONAL_LEAVE_EVENTS.map((ev) => ({ value: ev, label: PERSONAL_LEAVE_EVENT_LABEL[ev] }))}
        />
      )}

      <Field label="Lý do">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="rounded border px-2 py-1"
          required={requestType === "sick_leave"}
        />
      </Field>

      {showsDocumentField && (
        <FileField
          label="Tài liệu đính kèm (PDF, PNG hoặc JPEG)"
          accept="application/pdf,image/png,image/jpeg"
          onChange={setDocumentFile}
        />
      )}

      <p className="w-full text-sm text-gray-600">
        Nếu ngày nghỉ trùng buổi dạy của bạn, hãy đề cử giáo viên dạy thay bên dưới:
      </p>
      <SelectField
        label="Lớp học"
        value={coverClassId}
        onChange={setCoverClassId}
        options={(classes ?? []).map((c) => ({ value: c.id, label: c.courseLabel }))}
      />
      <DateField label="Ngày buổi học" value={coverSessionDate} onChange={setCoverSessionDate} />
      <SelectField
        label="Giáo viên dạy thay"
        value={coverNomineeId}
        onChange={setCoverNomineeId}
        options={teachers.map((t) => ({ value: t.id, label: t.fullName }))}
      />

      <button
        type="submit"
        disabled={submitRequest.isPending || uploadAttachment.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {submitRequest.isPending || uploadAttachment.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
