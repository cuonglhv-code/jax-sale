import { useMutation } from "@tanstack/react-query";
import { getAttachmentUrl } from "@/app/actions/hr/get-attachment-url";

/**
 * US6 (T055): mint a short-TTL signed URL on demand (a mutation, not a query — the URL expires in
 * ~2 minutes, so caching/refetching it like normal query data would be misleading). The approver's
 * "view document" button calls this, then opens the returned URL in a new tab immediately.
 */
export function useAttachmentUrl() {
  return useMutation({
    mutationFn: async (requestId: string) => {
      const result = await getAttachmentUrl(requestId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
