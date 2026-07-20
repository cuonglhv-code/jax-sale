import { sendSummitRoadmap } from "@/app/actions/roadmap/send-summit-roadmap";
import type { SendSummitRoadmapInput } from "@/schemas/summit";
import type { ActionResult } from "@/lib/server-action";

/**
 * The Summit's primary delivery mechanism (research D-DELIVERY): posts the client-generated PDF
 * + full send context to `sendSummitRoadmap`, which emails it server-side via Resend and
 * archives it atomically. NOTE (implementation deviation from the original research note): this
 * does NOT implement 002's narrow `DeliveryAdapter` interface ({studentName, studentEmail, pdf,
 * subjectVi, bodyVi}) — the archive needs the full request/capture/courseSequence/totalPrice
 * context that interface never carried, so forcing it through that shape would smuggle data
 * around the type system instead of expressing it. `DownloadMailDraftAdapter` (002) remains the
 * literal `DeliveryAdapter` used as the explicit consultant-facing fallback on send failure.
 */
export async function sendAndArchive(
  input: SendSummitRoadmapInput,
): Promise<ActionResult<{ sendId: string; deliveredTo: string }>> {
  return sendSummitRoadmap(input);
}
