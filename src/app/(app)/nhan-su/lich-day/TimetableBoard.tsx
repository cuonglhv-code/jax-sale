"use client";

import { useEffect, useState } from "react";
import { useClasses } from "@/hooks/queries/hr/useClasses";
import { listTeachers, type AssignableTeacher } from "@/app/actions/hr/list-teachers";
import { WEEKDAY_LABEL } from "@/lib/domain/vocabulary";
import type { TeachingClass } from "@/lib/data/types";
import type { UpsertClassInput } from "@/schemas/hr/class";
import { CreateClassDrawer } from "./CreateClassDrawer";

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 7];

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
 * US4 (T041): grouped-by-weekday timetable (design_handoff_jax_sales_phase2 — a spatial week grid
 * was considered and rejected: classes carry a single weekday + a date range, not fine-grained
 * recurring events, and volumes are low (a few dozen/centre), so a list sorted by start time already
 * puts same-day classes adjacent for conflict-spotting, reuses the HR-Reports section+table pattern
 * exactly, and adds zero new tokens — a grid would need a new calendar-cell token this module has no
 * other use for). Create/edit moved into a slide-over drawer (CreateClassDrawer), replacing the
 * previous always-visible top form.
 */
export function TimetableBoard() {
  const { data: classes, isLoading, error } = useClasses();
  const [teachers, setTeachers] = useState<AssignableTeacher[]>([]);
  const [form, setForm] = useState<UpsertClassInput>(EMPTY_FORM);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    listTeachers().then((result) => {
      if ("data" in result) setTeachers(result.data);
    });
  }, []);

  function openCreate() {
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(klass: TeachingClass) {
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
    setDrawerOpen(true);
  }

  const days = WEEKDAY_ORDER.map((weekday) => ({
    weekday,
    label: WEEKDAY_LABEL[weekday],
    rows: (classes ?? [])
      .filter((k) => k.weekday === weekday)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  })).filter((day) => day.rows.length > 0);

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-5 px-6 py-5 pb-8">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[12.5px] font-semibold text-text-muted">{classes?.length ?? 0} lớp đang lưu</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-[38px] items-center gap-[7px] rounded-[var(--radius-field)] bg-navy px-[15px] text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-navy-dark"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Tạo lớp học
        </button>
      </div>

      {isLoading && <p className="text-text-muted">Đang tải...</p>}
      {error && <p className="text-red">{error.message}</p>}
      {classes && classes.length === 0 && <p className="text-text-faint">Chưa có lớp học nào.</p>}

      <div className="flex flex-col gap-[18px]">
        {days.map((day) => (
          <section key={day.weekday} className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface">
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-[13px]">
              <span className="h-4 w-[3px] rounded-sm bg-red" />
              <h2 className="m-0 text-[14px] font-bold text-text">{day.label}</h2>
              <span className="text-xs font-medium text-text-faint">{day.rows.length} lớp</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] border-collapse text-[13px]">
                <thead>
                  <tr className="bg-surface-2">
                    <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                      Khóa / lớp
                    </th>
                    <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                      Giáo viên
                    </th>
                    <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                      Giờ
                    </th>
                    <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                      Khoảng ngày
                    </th>
                    <th className="border-b border-border px-4 py-[9px] text-left text-[11px] font-bold uppercase tracking-[.04em] text-text-muted">
                      Trạng thái
                    </th>
                    <th className="border-b border-border px-4 py-[9px]" />
                  </tr>
                </thead>
                <tbody>
                  {day.rows.map((klass, i) => (
                    <tr key={klass.id} className={`transition-colors hover:bg-surface-2 ${i % 2 ? "bg-surface-2" : ""}`}>
                      <td className="border-b border-border px-4 py-2.5 font-semibold text-text">{klass.courseLabel}</td>
                      <td className="border-b border-border px-4 py-2.5 text-text-muted">{klass.teacherId ? teachers.find((t) => t.id === klass.teacherId)?.fullName ?? "—" : "—"}</td>
                      <td className="border-b border-border px-4 py-2.5 text-text [font-variant-numeric:tabular-nums]">
                        {klass.startTime.slice(0, 5)}–{klass.endTime.slice(0, 5)}
                      </td>
                      <td className="border-b border-border px-4 py-2.5 text-text-muted [font-variant-numeric:tabular-nums]">
                        {klass.startDate} → {klass.endDate}
                      </td>
                      <td className="border-b border-border px-4 py-2.5">
                        <span
                          className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] py-[2px] text-[11.5px] font-semibold leading-[18px]"
                          style={
                            klass.isActive
                              ? { color: "var(--color-st-approved-text)", background: "var(--color-st-approved-bg)", borderColor: "var(--color-st-approved-border)" }
                              : { color: "var(--color-st-cancelled-text)", background: "var(--color-st-cancelled-bg)", borderColor: "var(--color-st-cancelled-border)" }
                          }
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
                          {klass.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                        </span>
                      </td>
                      <td className="border-b border-border px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(klass)}
                          className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold text-text transition-colors hover:bg-surface-3"
                        >
                          Sửa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>

      <CreateClassDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        form={form}
        onFormChange={setForm}
        teachers={teachers}
      />
    </div>
  );
}
