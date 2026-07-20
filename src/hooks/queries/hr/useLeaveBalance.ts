import { useQuery } from "@tanstack/react-query";
import { getMyBalance } from "@/app/actions/hr/get-my-balance";

/** Query-key factory — mutations that touch leave_balance invalidate via this same key shape. */
export const leaveBalanceQueryKeys = {
  mine: (leaveYear: number) => ["hrLeaveBalance", "mine", leaveYear] as const,
};

/** US3 (T028): own indicative annual-leave balance for a leave year (entitlement/consumed/remaining). */
export function useLeaveBalance(leaveYear: number) {
  return useQuery({
    queryKey: leaveBalanceQueryKeys.mine(leaveYear),
    queryFn: async () => {
      const result = await getMyBalance(leaveYear);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
  });
}
