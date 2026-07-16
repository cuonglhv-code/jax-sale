import type { DeliveryResult } from "@/services/ielts/types";

/**
 * The single injectable delivery seam (spec FR-DELIVERY-01/02, contracts/delivery-adapter.md). The
 * engine and UI depend ONLY on this interface — swapping the mechanism (download+draft → server
 * email) needs no engine/UI change.
 */
export interface DeliveryPayload {
  studentName: string;
  studentEmail: string;
  pdf: Blob;
  subjectVi: string;
  bodyVi: string;
}

export interface DeliveryAdapter {
  deliver(payload: DeliveryPayload): Promise<DeliveryResult>;
}

export type { DeliveryResult };
