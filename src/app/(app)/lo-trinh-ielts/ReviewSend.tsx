"use client";

import { useMemo, useState } from "react";
import { BRAND } from "@/lib/domain/ielts/brand";
import { SUMMIT_COPY } from "@/lib/domain/ielts/summit-copy";
import { formatVnd } from "@/lib/domain/ielts/pricing";
import type { SummitPdfMeta } from "@/lib/ielts/pdf/SummitDocument";
import { toDocumentView, type SummitRoadmap } from "@/services/ielts/summit-types";
import { captureSchema, type CaptureInput } from "@/schemas/summit";
import { applyDiscount, type DiscountInput } from "@/lib/domain/ielts/pricing-discount";
import { sendAndArchive } from "@/services/ielts/delivery/email-send";
import { DownloadMailDraftAdapter } from "@/services/ielts/delivery/download-maildraft";
import {
  initialReviewEdits,
  toggleRemoveCourse,
  moveCourse,
  updateNarrative,
  updateConsultantNotes,
  departsFromStandardLadder,
  applyReviewEdits,
  type ReviewEdits,
} from "@/services/ielts/review-edits";
import { EditableNarrative } from "./EditableNarrative";
import type { ConsultantInfo } from "./Summit";

type Props = {
  roadmap: SummitRoadmap;
  consultant: ConsultantInfo;
  discount: DiscountInput | null;
  onBack: () => void;
  onDocumentPrepared: () => void;
  onSent: () => void;
};

const downloadFallback = new DownloadMailDraftAdapter();

/** Blob → base64 (no data: URL prefix) for the send action's `pdfBase64` field. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Review, edit, capture, send (spec Story 3; contracts/presentation.md §Review & send). The
 * preview renders from the SAME `SummitDocument` the PDF uses — one source, SC-003.
 */
export function ReviewSend({ roadmap, consultant, discount, onBack, onDocumentPrepared, onSent }: Props) {
  const [edits, setEdits] = useState<ReviewEdits>(() => initialReviewEdits(roadmap));
  const [capture, setCapture] = useState<Partial<CaptureInput>>({
    consultantName: consultant.name,
    consultantEmail: consultant.email,
    consultantPhone: null,
    studentPhone: null,
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastPdfBlob, setLastPdfBlob] = useState<Blob | null>(null);
  const [generationKey] = useState(() => crypto.randomUUID());

  const reviewed = useMemo(() => applyReviewEdits(roadmap, edits), [roadmap, edits]);
  const breakdown = applyDiscount(reviewed.totalPrice.amount, discount);
  const warnsDeparture = departsFromStandardLadder(roadmap, edits);
  const climb = reviewed.stages;

  const meta: SummitPdfMeta = {
    consultantName: capture.consultantName || consultant.name,
    consultantPhone: capture.consultantPhone ?? null,
    consultantEmail: capture.consultantEmail ?? consultant.email,
    centreName: consultant.centreName,
  };

  async function buildPdfBlob(): Promise<Blob> {
    const view = toDocumentView(reviewed);
    const [{ pdf }, { SummitDocument }] = await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/ielts/pdf/SummitDocument"),
    ]);
    return pdf(<SummitDocument view={view} meta={meta} totalPriceBreakdown={breakdown} />).toBlob();
  }

  async function handleSend() {
    const parsedCapture = captureSchema.safeParse({
      studentEmail: capture.studentEmail,
      studentPhone: capture.studentPhone ?? null,
      consultantName: capture.consultantName || consultant.name,
      consultantPhone: capture.consultantPhone ?? null,
      consultantEmail: capture.consultantEmail || consultant.email,
    });
    if (!parsedCapture.success) {
      setErrorMessage(parsedCapture.error.issues[0]?.message ?? SUMMIT_COPY.sendFailureBody);
      return;
    }

    setStatus("sending");
    setErrorMessage(null);
    try {
      const blob = await buildPdfBlob();
      setLastPdfBlob(blob);
      onDocumentPrepared();
      const pdfBase64 = await blobToBase64(blob);

      const result = await sendAndArchive({
        generationKey,
        request: reviewed.request,
        capture: parsedCapture.data,
        courseSequence: climb.map((s) => s.code),
        totalPrice: breakdown.net,
        manualEdited: reviewed.manualEdited,
        pdfBase64,
      });

      if ("error" in result) {
        setStatus("failed");
        setErrorMessage(result.error);
        return;
      }
      setStatus("sent");
      onSent();
    } catch (err) {
      setStatus("failed");
      setErrorMessage(err instanceof Error ? err.message : SUMMIT_COPY.sendFailureBody);
    }
  }

  async function handleDownloadFallback() {
    const blob = lastPdfBlob ?? (await buildPdfBlob());
    await downloadFallback.deliver({
      studentName: reviewed.request.studentName,
      studentEmail: capture.studentEmail ?? "",
      pdf: blob,
      subjectVi: SUMMIT_COPY.emailSubject,
      bodyVi: SUMMIT_COPY.emailBody(reviewed.request.studentName),
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: BRAND.color.navy }}>
            {SUMMIT_COPY.reviewTitle}
          </h2>
          <p className="text-sm text-neutral-600">{SUMMIT_COPY.reviewSubtitle}</p>
        </div>
        <button type="button" onClick={onBack} className="rounded-lg border px-3 py-1.5 text-sm font-medium">
          {SUMMIT_COPY.railBack}
        </button>
      </header>

      <label className="flex flex-col gap-1 text-sm font-semibold" style={{ color: BRAND.color.navy }}>
        {SUMMIT_COPY.consultantNoteLabel}
        <textarea
          rows={2}
          value={edits.consultantNotes ?? ""}
          onChange={(e) => setEdits((prev) => updateConsultantNotes(prev, e.target.value))}
          className="w-full resize-none rounded-md border px-2 py-1 text-sm"
        />
      </label>

      {warnsDeparture && (
        <p className="rounded-lg border-2 px-4 py-2 text-sm font-semibold" style={{ borderColor: BRAND.color.red, color: BRAND.color.red }}>
          {SUMMIT_COPY.departsLadderWarning}
        </p>
      )}

      <ol className="flex flex-col gap-3">
        {climb.map((stage, i) => (
          <li key={stage.code} className="rounded-xl border p-4" style={{ borderColor: `${BRAND.color.navy}22` }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-base font-bold" style={{ color: BRAND.color.navy }}>{stage.name}</h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold" style={{ color: BRAND.color.red }}>
                  {formatVnd(stage.price ?? 0)}
                </span>
                <button type="button" disabled={i === 0} onClick={() => setEdits((p) => moveCourse(p, stage.code, -1))} className="rounded border px-2 py-1 disabled:opacity-30">
                  {SUMMIT_COPY.moveUp}
                </button>
                <button type="button" disabled={i === climb.length - 1} onClick={() => setEdits((p) => moveCourse(p, stage.code, 1))} className="rounded border px-2 py-1 disabled:opacity-30">
                  {SUMMIT_COPY.moveDown}
                </button>
                <button type="button" onClick={() => setEdits((p) => toggleRemoveCourse(p, stage.code))} className="rounded border px-2 py-1" style={{ color: BRAND.color.red }}>
                  {SUMMIT_COPY.removeCourse}
                </button>
              </div>
            </div>
            {stage.narrative && (
              <EditableNarrative
                narrative={stage.narrative}
                onChange={(n) => setEdits((p) => updateNarrative(p, stage.code, n))}
              />
            )}
          </li>
        ))}
      </ol>

      <fieldset className="grid grid-cols-2 gap-3 rounded-xl border p-4" style={{ borderColor: `${BRAND.color.navy}22` }}>
        <legend className="px-1 text-sm font-bold" style={{ color: BRAND.color.navy }}>
          {SUMMIT_COPY.captureTitle}
        </legend>
        <CaptureField
          label={SUMMIT_COPY.studentEmailLabel}
          value={capture.studentEmail ?? ""}
          onChange={(v) => setCapture((p) => ({ ...p, studentEmail: v }))}
        />
        <CaptureField
          label={SUMMIT_COPY.studentPhoneLabel}
          value={capture.studentPhone ?? ""}
          onChange={(v) => setCapture((p) => ({ ...p, studentPhone: v || null }))}
        />
        <CaptureField
          label={SUMMIT_COPY.consultantNameLabel}
          value={capture.consultantName ?? ""}
          onChange={(v) => setCapture((p) => ({ ...p, consultantName: v }))}
        />
        <CaptureField
          label={SUMMIT_COPY.consultantPhoneLabel}
          value={capture.consultantPhone ?? ""}
          onChange={(v) => setCapture((p) => ({ ...p, consultantPhone: v || null }))}
        />
        <CaptureField
          label={SUMMIT_COPY.consultantEmailLabel}
          value={capture.consultantEmail ?? ""}
          onChange={(v) => setCapture((p) => ({ ...p, consultantEmail: v || null }))}
        />
      </fieldset>

      {status === "failed" && errorMessage && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border-2 p-4" style={{ borderColor: BRAND.color.red }}>
          <p className="text-sm font-bold" style={{ color: BRAND.color.red }}>{SUMMIT_COPY.sendFailureTitle}</p>
          <p className="text-sm">{SUMMIT_COPY.sendFailureBody}</p>
          <p className="text-xs text-neutral-600">{errorMessage}</p>
          <div className="flex gap-2">
            <button type="button" onClick={handleSend} className="rounded-lg px-3 py-1.5 text-sm font-bold text-white" style={{ backgroundColor: BRAND.color.red }}>
              {SUMMIT_COPY.retrySend}
            </button>
            <button type="button" onClick={handleDownloadFallback} className="rounded-lg border px-3 py-1.5 text-sm font-medium">
              {SUMMIT_COPY.downloadFallback}
            </button>
          </div>
        </div>
      )}

      {status === "sent" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
          {SUMMIT_COPY.sendSuccess}
        </p>
      )}

      {status !== "sent" && (
        <button
          type="button"
          onClick={handleSend}
          disabled={status === "sending"}
          className="self-start rounded-lg px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          style={{ backgroundColor: BRAND.color.navy }}
        >
          {status === "sending" ? SUMMIT_COPY.sending : SUMMIT_COPY.sendButton}
        </button>
      )}
    </section>
  );
}

function CaptureField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: BRAND.color.navy }}>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border px-2 py-1 text-sm"
      />
    </label>
  );
}
