"use client";

import { useEffect, useState } from "react";
import { useSubmitRequest } from "@/hooks/mutations/hr/useSubmitRequest";
import { useClasses } from "@/hooks/queries/hr/useClasses";
import { listTeachers, type AssignableTeacher } from "@/app/actions/hr/list-teachers";
import { LEAVE_DAY_PARTS, PERSONAL_LEAVE_EVENTS, type LeaveDayPart, type PersonalLeaveEvent } from "@/lib/data/types";
import { LEAVE_DAY_PART_LABEL, PERSONAL_LEAVE_EVENT_LABEL } from "@/lib/domain/vocabulary";
import { DateField, SelectField, Field } from "@/components/form";

interface LeaveFamilyFormProps {
  requestType: "sick_leave" | "personal_leave" | "unpaid_leave";
}

/**
 * US5 (T049): shared form for the three non-annual leave-family types (sick/personal/unpaid) — same
 * date-range + day-part + cover-picker shape as AnnualLeaveForm (US1/US4), minus the balance display
 * (none of these draw the annual-leave balance, FR-007/FR-014). `personal_leave` additionally shows
 * the statutory event picker (data-model §10); sick leave's documentation requirement (FR-031) has
 * no upload UI yet — that is US6 — so this form only submits the leave itself.
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
  const [error, setError] = useState<string | null>(null);
  const submitRequest = useSubmitRequest();
  const { data: classes } = useClasses();
  const [teachers, setTeachers] = useState<AssignableTeacher[]>([]);

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
      if (requestType === "personal_leave") {
        await submitRequest.mutateAsync({ requestType, ...base, event, reason: reason || undefined });
      } else if (requestType === "unpaid_leave") {
        await submitRequest.mutateAsync({ requestType, ...base, reason: reason || undefined });
      } else {
        await submitRequest.mutateAsync({ requestType, ...base });
      }

      setStartDate("");
      setEndDate("");
      setDayPart("full");
      setEvent("marriage_self");
      setReason("");
      setCoverClassId("");
      setCoverSessionDate("");
      setCoverNomineeId("");
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

      {requestType !== "sick_leave" && (
        <Field label="Lý do">
          <input value={reason} onChange={(e) => setReason(e.target.value)} className="rounded border px-2 py-1" />
        </Field>
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
        disabled={submitRequest.isPending}
        className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {submitRequest.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
