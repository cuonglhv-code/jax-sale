"use client";

import { useEffect, useState } from "react";
import { useSubmitRequest } from "@/hooks/mutations/hr/useSubmitRequest";
import { useClasses } from "@/hooks/queries/hr/useClasses";
import { listTeachers, type AssignableTeacher } from "@/app/actions/hr/list-teachers";
import type { LeaveDayPart } from "@/lib/data/types";
import { DateField, SelectField, Field, DayPartField } from "@/components/form";

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
    <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
      {remainingDays !== null && (
        <p className="m-0 text-[12.5px] text-text-muted">Số ngày phép còn lại: {remainingDays}</p>
      )}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <DateField label="Ngày bắt đầu" value={startDate} onChange={setStartDate} required />
        <DateField label="Ngày kết thúc" value={endDate} onChange={setEndDate} required min={startDate || undefined} />
      </div>
      <DayPartField value={dayPart} onChange={setDayPart} />
      <Field label="Ghi chú">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-10 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
        />
      </Field>

      <p className="m-0 text-[12.5px] text-text-muted">
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

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={submitRequest.isPending}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--radius-field)] bg-navy px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-dark disabled:cursor-default disabled:opacity-80"
        >
          {submitRequest.isPending && (
            <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-navy-tint-2" style={{ borderTopColor: "white" }} />
          )}
          {submitRequest.isPending ? "Đang gửi..." : "Gửi yêu cầu"}
        </button>
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      {overBalanceWarning && (
        <div className="flex items-center gap-1.5 rounded-lg border border-pri-mid-border bg-pri-mid-bg px-2.5 py-2 text-[12.5px] font-medium text-pri-mid-text">
          Yêu cầu này vượt quá số ngày phép còn lại của bạn. Yêu cầu vẫn được gửi để quản lý xem xét.
        </div>
      )}
    </form>
  );
}
