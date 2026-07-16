"use client";

import { useState } from "react";
import { roadmapRequestSchema, type RoadmapRequestInput } from "@/schemas/roadmap";
import { CURRENT_BAND_OPTIONS, TARGET_BAND_OPTIONS } from "@/lib/domain/ielts/bands";
import { AUDIENCES, INTENSITIES, EXAM_PURPOSES, AUDIENCE_LABEL, INTENSITY_LABEL, EXAM_PURPOSE_LABEL, bandLabel } from "@/lib/domain/ielts/labels";

const input = "rounded border px-2 py-1 w-full";

export function RoadmapForm({
  consultant,
  onGenerate,
}: {
  consultant: { name: string; email: string; centreName: string };
  onGenerate: (req: RoadmapRequestInput) => void;
}) {
  const [f, setF] = useState<Record<string, string>>({
    studentName: "", studentEmail: "", studentPhone: "", audience: "THPT",
    currentBand: "3.5", targetBand: "6.5", examPurpose: "XET_TUYEN_DH", targetExamDate: "",
    intensity: "TIEU_CHUAN", consultantName: consultant.name, consultantPhone: "", consultantEmail: consultant.email,
  });
  const [error, setError] = useState<string | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = roadmapRequestSchema.safeParse({
      studentName: f.studentName, audience: f.audience, studentEmail: f.studentEmail,
      studentPhone: f.studentPhone || null, currentBand: f.currentBand, targetBand: f.targetBand,
      examPurpose: f.examPurpose, targetExamDate: f.targetExamDate || null, intensity: f.intensity,
      consultantName: f.consultantName, consultantPhone: f.consultantPhone || null,
      consultantEmail: f.consultantEmail || null, startDate: null,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }
    onGenerate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 rounded border p-4">
      <label className="text-sm">Tên học viên<input className={input} value={f.studentName} onChange={(e) => set("studentName", e.target.value)} /></label>
      <label className="text-sm">Email học viên<input className={input} value={f.studentEmail} onChange={(e) => set("studentEmail", e.target.value)} /></label>
      <label className="text-sm">SĐT học viên<input className={input} value={f.studentPhone} onChange={(e) => set("studentPhone", e.target.value)} /></label>
      <label className="text-sm">Đối tượng
        <select className={input} value={f.audience} onChange={(e) => set("audience", e.target.value)}>
          {AUDIENCES.map((a) => <option key={a} value={a}>{AUDIENCE_LABEL[a]}</option>)}
        </select>
      </label>
      <label className="text-sm">Band hiện tại
        <select className={input} value={f.currentBand} onChange={(e) => set("currentBand", e.target.value)}>
          {CURRENT_BAND_OPTIONS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}
        </select>
      </label>
      <label className="text-sm">Band mục tiêu
        <select className={input} value={f.targetBand} onChange={(e) => set("targetBand", e.target.value)}>
          {TARGET_BAND_OPTIONS.map((b) => <option key={b} value={b}>{bandLabel(b)}</option>)}
        </select>
      </label>
      <label className="text-sm">Mục đích thi
        <select className={input} value={f.examPurpose} onChange={(e) => set("examPurpose", e.target.value)}>
          {EXAM_PURPOSES.map((p) => <option key={p} value={p}>{EXAM_PURPOSE_LABEL[p]}</option>)}
        </select>
      </label>
      <label className="text-sm">Ngày thi dự kiến<input type="date" className={input} value={f.targetExamDate} onChange={(e) => set("targetExamDate", e.target.value)} /></label>
      <label className="text-sm">Cường độ
        <select className={input} value={f.intensity} onChange={(e) => set("intensity", e.target.value)}>
          {INTENSITIES.map((i) => <option key={i} value={i}>{INTENSITY_LABEL[i]}</option>)}
        </select>
      </label>
      <div />
      {error && <p className="col-span-2 text-sm text-red-600">{error}</p>}
      <button type="submit" className="col-span-2 rounded bg-blue-600 px-4 py-2 text-white">Tạo lộ trình</button>
    </form>
  );
}
