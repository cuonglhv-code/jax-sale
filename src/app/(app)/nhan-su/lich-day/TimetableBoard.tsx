"use client";

import { useEffect, useState } from "react";
import { useClasses } from "@/hooks/queries/hr/useClasses";
import { useUpsertClass } from "@/hooks/mutations/hr/useUpsertClass";
import { listTeachers, type AssignableTeacher } from "@/app/actions/hr/list-teachers";
import { WEEKDAY_LABEL } from "@/lib/domain/vocabulary";
import type { TeachingClass } from "@/lib/data/types";
import type { UpsertClassInput } from "@/schemas/hr/class";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

const EMPTY_FORM: UpsertClassInput = {
  courseLabel: "",
  teacherId: "",
  weekday: 1,
  startTime: "18:00",
  endTime: "20:00",
  startDate: "",
  endDate: "",
  isActive: true,
};

/**
 * US4 (T041): minimal timetable admin — a list of classes plus a create/edit form. Plain useState +
 * server-authoritative Zod (R9), no form library, matching the rest of this slice's UI convention.
 */
export function TimetableBoard() {
  const { data: classes, isLoading, error } = useClasses();
  const upsert = useUpsertClass();
  const [teachers, setTeachers] = useState<AssignableTeacher[]>([]);
  const [form, setForm] = useState<UpsertClassInput>(EMPTY_FORM);

  useEffect(() => {
    listTeachers().then((result) => {
      if ("data" in result) setTeachers(result.data);
    });
  }, []);

  function startEdit(klass: TeachingClass) {
    setForm({
      id: klass.id,
      courseLabel: klass.courseLabel,
      teacherId: klass.teacherId,
      weekday: klass.weekday,
      startTime: klass.startTime.slice(0, 5),
      endTime: klass.endTime.slice(0, 5),
      startDate: klass.startDate,
      endDate: klass.endDate,
      isActive: klass.isActive,
    });
  }

  function resetForm() {
    setForm(EMPTY_FORM);
  }

  function submit() {
    upsert.mutate(form, { onSuccess: resetForm });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded border p-3 text-sm">
        <span className="font-medium">{form.id ? "Sửa lớp học" : "Thêm lớp học"}</span>
        <input
          className="rounded border p-2"
          placeholder="Tên lớp"
          value={form.courseLabel}
          onChange={(e) => setForm({ ...form, courseLabel: e.target.value })}
        />
        <select
          className="rounded border p-2"
          value={form.teacherId}
          onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
        >
          <option value="">Chọn giáo viên</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.fullName}
            </option>
          ))}
        </select>
        <select
          className="rounded border p-2"
          value={form.weekday}
          onChange={(e) => setForm({ ...form, weekday: Number(e.target.value) })}
        >
          {WEEKDAYS.map((d) => (
            <option key={d} value={d}>
              {WEEKDAY_LABEL[d]}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <input
            type="time"
            className="rounded border p-2"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
          <input
            type="time"
            className="rounded border p-2"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <input
            type="date"
            className="rounded border p-2"
            value={form.startDate}
            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          />
          <input
            type="date"
            className="rounded border p-2"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Đang hoạt động
        </label>
        {upsert.error && <p className="text-red-600">{upsert.error.message}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
            disabled={upsert.isPending || !form.courseLabel || !form.teacherId || !form.startDate || !form.endDate}
            onClick={submit}
          >
            {form.id ? "Lưu" : "Thêm"}
          </button>
          {form.id && (
            <button type="button" className="rounded border px-3 py-1" onClick={resetForm}>
              Hủy
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {isLoading && <p>Đang tải...</p>}
        {error && <p className="text-red-600">{error.message}</p>}
        {classes && classes.length === 0 && <p className="text-gray-500">Chưa có lớp học nào.</p>}
        {classes?.map((klass) => (
          <div key={klass.id} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
            <span className="font-medium">{klass.courseLabel}</span>
            <span>{" · "}{WEEKDAY_LABEL[klass.weekday]}</span>
            <span>
              {" · "}
              {klass.startTime.slice(0, 5)}–{klass.endTime.slice(0, 5)}
            </span>
            <span>
              {" · "}
              {klass.startDate} → {klass.endDate}
            </span>
            {!klass.isActive && <span className="text-gray-500">{" · Ngừng hoạt động"}</span>}
            <button type="button" className="ml-auto rounded border px-3 py-1" onClick={() => startEdit(klass)}>
              Sửa
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
