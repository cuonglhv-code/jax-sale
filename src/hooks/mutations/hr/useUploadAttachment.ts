import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadAttachment } from "@/app/actions/hr/upload-attachment";
import { myRequestsQueryKeys } from "@/hooks/queries/hr/useMyRequests";
import { approvalQueueQueryKeys } from "@/hooks/queries/hr/useApprovalQueue";

export interface UploadAttachmentVariables {
  requestId: string;
  file: File;
}

/** US6 (T055): upload a medical/personal-leave document for an already-submitted request. */
export function useUploadAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, file }: UploadAttachmentVariables) => {
      const bytes = await file.arrayBuffer();
      const result = await uploadAttachment(requestId, file.name, file.type, bytes);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: myRequestsQueryKeys.all });
      queryClient.invalidateQueries({ queryKey: approvalQueueQueryKeys.all });
    },
  });
}
