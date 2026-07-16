"use client";

import { useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { generateRoadmap, toStudentView } from "@/services/ielts/roadmap-engine";
import { RoadmapDocument, type RoadmapPdfMeta } from "@/lib/ielts/pdf/RoadmapDocument";
import { DownloadMailDraftAdapter } from "@/services/ielts/delivery/download-maildraft";
import { BRAND } from "@/lib/domain/ielts/brand";
import { submitRoadmap } from "@/app/actions/roadmap/submit-roadmap";
import { bandLabel } from "@/lib/domain/ielts/labels";
import type { Roadmap } from "@/services/ielts/types";
import type { RoadmapRequestInput } from "@/schemas/roadmap";
import { RoadmapForm } from "./RoadmapForm";
import { RoadmapReview } from "./RoadmapReview";

const adapter = new DownloadMailDraftAdapter();

/** Orchestrator (US1 + US5 + T041): form → engine → review/edit → approve → PDF + deliver + log. */
export function RoadmapBuilder({ consultant }: { consultant: { name: string; email: string; centreName: string } }) {
  const [request, setRequest] = useState<RoadmapRequestInput | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [genKey, setGenKey] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handleGenerate(req: RoadmapRequestInput) {
    setRequest(req);
    setRoadmap(
      generateRoadmap({
        ...req,
        studentPhone: req.studentPhone ?? null,
        targetExamDate: req.targetExamDate ?? null,
        consultantPhone: req.consultantPhone ?? null,
        consultantEmail: req.consultantEmail ?? null,
        startDate: req.startDate ?? null,
        centreId: "self",
      }),
    );
    setGenKey(crypto.randomUUID());
    setNote("");
    setMessage(null);
  }

  function handleRemoveCourse(index: number) {
    if (!roadmap) return;
    const courses = roadmap.courses.filter((_, i) => i !== index);
    setRoadmap({ ...roadmap, courses, manualEdited: true });
  }

  async function handleApprove() {
    if (!roadmap || !request) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const view = toStudentView({ ...roadmap, consultantNotes: note || null });
      const meta: RoadmapPdfMeta = {
        studentName: request.studentName,
        currentBandLabel: bandLabel(request.currentBand),
        targetBandLabel: bandLabel(request.targetBand),
        consultantName: request.consultantName,
        consultantPhone: request.consultantPhone ?? null,
        consultantEmail: request.consultantEmail ?? null,
        centreName: consultant.centreName,
        logoSrc: BRAND.asset.logo,
      };
      const blob = await pdf(<RoadmapDocument view={view} meta={meta} />).toBlob();
      const delivery = await adapter.deliver({
        studentName: request.studentName,
        studentEmail: request.studentEmail,
        pdf: blob,
        subjectVi: "Lộ trình học IELTS cá nhân hoá của bạn",
        bodyVi: `Chào ${request.studentName}, Jaxtina gửi bạn lộ trình học IELTS cá nhân hoá (đính kèm PDF).`,
      });

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setMessage("Đã tạo PDF. Chưa ghi nhật ký (mất kết nối) — vui lòng thử lại khi có mạng.");
        return;
      }

      const result = await submitRoadmap({
        request: { ...request, startDate: null },
        courseSequence: roadmap.courses.map((c) => c.code),
        manualEdited: roadmap.manualEdited,
        generationKey: genKey,
        deliveryStatus: delivery.status,
      });
      setMessage(
        "error" in result
          ? result.error
          : delivery.status === "drafted"
            ? "Đã tải PDF và mở email nháp. Vui lòng đính kèm PDF và gửi."
            : "Đã gửi cho học viên.",
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Đã xảy ra lỗi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Lộ trình IELTS</h1>
      <RoadmapForm consultant={consultant} onGenerate={handleGenerate} />
      {roadmap && (
        <RoadmapReview
          roadmap={roadmap}
          note={note}
          onNoteChange={setNote}
          onRemoveCourse={handleRemoveCourse}
          onApprove={handleApprove}
          submitting={submitting}
          message={message}
        />
      )}
    </div>
  );
}
