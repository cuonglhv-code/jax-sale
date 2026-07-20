"use client";

import { useEffect, useState } from "react";
import { useSubmitRequest } from "@/hooks/mutations/hr/useSubmitRequest";
import { useClasses } from "@/hooks/queries/hr/useClasses";
import { listTeachers, type AssignableTeacher } from "@/app/actions/hr/list-teachers";
import { LEAVE_DAY_PARTS, type LeaveDayPart } from "@/lib/data/types";
import { LEAVE_DAY_PART_LABEL } from "@/lib/domain/vocabulary";
import { DateField, SelectField, Field } from "@/components/form";

interface AnnualLeaveFormProps {
  remainingDays: number | null;
}

/**
 * US1 (T022) + US4 (T042): the annual-leave form — hand-coded fields (no react-hook-form), server
 * Zod validates. The cover-nomination fields (class + session date + nominee) are shown always but
 * only REQUIRED server-side when the resolver finds the leave overlaps a taught session — the
 * submit error names the affected session so the teacher knows to fill them in and resubmit.
 */
export function AnnualLeaveForm({ remainingDays }: AnnualLeaveFormProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dayPart, setDayPart] = useState<LeaveDayPart>("full");
  const [note, setNote] = useState("");
  const [coverClassId, setCoverClassId] = useState("");
  const [coverSessionDate, setCoverSessionDate] = useState("");
  const [coverNomineeId, setCoverNomineeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [overBalanceWarning, setOverBalanceWarning] = useState(false);
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
    setOverBalanceWarning(false);
    try {
      const covers =
        coverClassId && coverSessionDate && coverNomineeId
          ? [{ classId: coverClassId, sessionDate: coverSessionDate, nomineeId: coverNomineeId }]
          : undefined;
      const result = await submitRequest.mutateAsync({
        requestType: "annual_leave",
        startDate,
        endDate,
        dayPart,
        note: note || undefined,
        covers,
      });
      setOverBalanceWarning(result.overBalanceWarning);
      setStartDate("");
      setEndDate("");
      setDayPart("full");
      setNote("");
      setCoverClassId("");
      setCoverSessionDate("");
      setCoverNomineeId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded border p-4">
      {remainingDays !== null && (
        <p className="w-full text-sm text-gray-600">Số ngày phép còn lại: {remainingDays}</p>
      )}
      <DateField label="Ngày bắt đầu" value={startDate} onChange={setStartDate} required />
      <DateField label="Ngày kết thúc" value={endDate} onChange={setEndDate} required min={startDate || undefined} />
      <SelectField
        label="Buổi nghỉ"
        value={dayPart}
        onChange={(v) => setDayPart(v as LeaveDayPart)}
        options={LEAVE_DAY_PARTS.map((p) => ({ value: p, label: LEAVE_DAY_PART_LABEL[p] }))}
      />
      <Field label="Ghi chú">
        <input value={note} onChange={(e) => setNote(e.target.value)} className="rounded border px-2 py-1" />
      </Field>

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
      {overBalanceWarning && (
        <p className="w-full text-sm text-amber-600">
          Yêu cầu này vượt quá số ngày phép còn lại của bạn. Yêu cầu vẫn được gửi để quản lý xem xét.
        </p>
      )}
    </form>
  );
}
