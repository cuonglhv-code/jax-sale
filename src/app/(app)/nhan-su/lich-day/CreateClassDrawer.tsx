"use client";

import { useUpsertClass } from "@/hooks/mutations/hr/useUpsertClass";
import { WEEKDAY_LABEL } from "@/lib/domain/vocabulary";
import type { AssignableTeacher } from "@/app/actions/hr/list-teachers";
import type { UpsertClassInput } from "@/schemas/hr/class";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

const selectClass =
  "h-10 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]";

interface CreateClassDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  form: UpsertClassInput;
  onFormChange: (form: UpsertClassInput) => void;
  teachers: AssignableTeacher[];
}

/** US4 (T041): create/edit-class slide-over, matching CreateTaskDrawer's pattern — replaces the
 *  previous always-visible top form (design_handoff_jax_sales_phase2). */
export function CreateClassDrawer({ isOpen, onClose, form, onFormChange, teachers }: CreateClassDrawerProps) {
  const upsert = useUpsertClass();

  function submit() {
    upsert.mutate(form, { onSuccess: onClose });
  }

  if (!isOpen) return null;

  const isValid = form.courseLabel && form.teacherId && form.startDate && form.endDate;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div onClick={onClose} className="absolute inset-0 bg-[rgba(10,14,30,.5)] backdrop-blur-[2px]" />
      <div className="relative flex h-full w-[440px] max-w-[92vw] flex-col overflow-y-auto border-l border-border bg-surface shadow-lg">
        <div className="sticky top-0 z-[2] flex items-center gap-2.5 border-b border-border bg-surface px-5 py-[18px]">
          <span className="h-5 w-[3px] rounded-sm bg-red" />
          <h2 className="m-0 text-base font-bold text-text">{form.id ? "Sửa lớp học" : "Tạo lớp học"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">
              Tên khóa / lớp <span className="text-red">*</span>
            </span>
            <input
              value={form.courseLabel}
              onChange={(e) => onFormChange({ ...form, courseLabel: e.target.value })}
              placeholder="VD: IELTS 6.5 — ca tối"
              className="h-10 rounded-[var(--radius-field)] border border-border bg-surface-2 px-2.5 text-[13.5px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Giáo viên</span>
            <select value={form.teacherId} onChange={(e) => onFormChange({ ...form, teacherId: e.target.value })} className={selectClass}>
              <option value="">Chọn giáo viên</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Thứ trong tuần</span>
            <select
              value={form.weekday}
              onChange={(e) => onFormChange({ ...form, weekday: Number(e.target.value) })}
              className={selectClass}
            >
              {WEEKDAYS.map((d) => (
                <option key={d} value={d}>
                  {WEEKDAY_LABEL[d]}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-text">Giờ bắt đầu</span>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => onFormChange({ ...form, startTime: e.target.value })}
                className={selectClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-text">Giờ kết thúc</span>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => onFormChange({ ...form, endTime: e.target.value })}
                className={selectClass}
              />
            </label>
          </div>

          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-text">Từ ngày</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => onFormChange({ ...form, startDate: e.target.value })}
                className={selectClass}
              />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-[12.5px] font-semibold text-text">Đến ngày</span>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => onFormChange({ ...form, endDate: e.target.value })}
                className={selectClass}
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-semibold text-text">Trạng thái</span>
            <div className="inline-flex gap-[3px] rounded-[var(--radius-field)] border border-border bg-surface-3 p-[3px]">
              <button
                type="button"
                onClick={() => onFormChange({ ...form, isActive: true })}
                className="h-8 flex-1 rounded-md text-[12.5px] font-semibold transition-all"
                style={
                  form.isActive
                    ? { background: "var(--color-st-approved-bg)", color: "var(--color-st-approved-text)", boxShadow: "inset 0 0 0 1px var(--color-st-approved-border)" }
                    : { color: "var(--color-text-muted)" }
                }
              >
                Đang hoạt động
              </button>
              <button
                type="button"
                onClick={() => onFormChange({ ...form, isActive: false })}
                className="h-8 flex-1 rounded-md text-[12.5px] font-semibold transition-all"
                style={
                  !form.isActive
                    ? { background: "var(--color-st-cancelled-bg)", color: "var(--color-st-cancelled-text)", boxShadow: "inset 0 0 0 1px var(--color-st-cancelled-border)" }
                    : { color: "var(--color-text-muted)" }
                }
              >
                Ngừng hoạt động
              </button>
            </div>
          </div>

          {upsert.error && <p className="text-sm text-red">{upsert.error.message}</p>}
        </div>

        <div className="sticky bottom-0 flex gap-2.5 border-t border-border bg-surface px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-[42px] flex-1 rounded-[var(--radius-field)] border border-border bg-surface-2 text-[13.5px] font-semibold text-text transition-colors hover:border-border-strong hover:bg-surface-3"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={upsert.isPending || !isValid}
            className="flex h-[42px] flex-1 items-center justify-center gap-2 rounded-[var(--radius-field)] bg-navy text-[13.5px] font-semibold text-white transition-colors hover:bg-navy-dark disabled:cursor-default disabled:opacity-80"
          >
            {upsert.isPending && (
              <span className="h-[13px] w-[13px] animate-spin rounded-full border-2 border-navy-tint-2" style={{ borderTopColor: "white" }} />
            )}
            {upsert.isPending ? "Đang lưu..." : form.id ? "Lưu" : "Tạo lớp học"}
          </button>
        </div>
      </div>
    </div>
  );
}
