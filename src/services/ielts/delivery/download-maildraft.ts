import type { DeliveryAdapter, DeliveryPayload } from "./adapter";
import type { DeliveryResult } from "@/services/ielts/types";

/**
 * Default delivery (this slice): download the PDF and open a pre-filled Vietnamese mailto draft
 * (the consultant attaches the just-downloaded PDF — mailto cannot attach). Returns `drafted`
 * (never a confirmed send). A future ServerEmailAdapter implements the same interface server-side.
 */
export class DownloadMailDraftAdapter implements DeliveryAdapter {
  async deliver(payload: DeliveryPayload): Promise<DeliveryResult> {
    try {
      if (typeof window === "undefined" || typeof document === "undefined") {
        return { status: "failed", detail: "Chỉ khả dụng trên trình duyệt." };
      }
      const url = URL.createObjectURL(payload.pdf);
      const fileName = `Lo-trinh-IELTS-${payload.studentName}.pdf`.replace(/\s+/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      const mailto = `mailto:${encodeURIComponent(payload.studentEmail)}?subject=${encodeURIComponent(
        payload.subjectVi,
      )}&body=${encodeURIComponent(payload.bodyVi)}`;
      window.open(mailto, "_blank");

      return { status: "drafted" };
    } catch (err) {
      return { status: "failed", detail: err instanceof Error ? err.message : "Lỗi gửi." };
    }
  }
}
