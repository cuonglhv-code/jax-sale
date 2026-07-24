import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { listTasksCore } from "@/services/task.service";
import { tasksQueryKeys } from "@/hooks/queries/useTasks";
import { ALL_CENTRES, isNetworkWideRole } from "@/lib/domain/vocabulary";
import { CalendarBoard } from "./CalendarBoard";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ centre?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const claims = await getVerifiedClaims(supabase);

  const departments = (await supabase.from("departments").select("id, name").order("name")).data ?? [];

  const { centre } = await searchParams;
  const showSwitcher = isNetworkWideRole(claims.role);
  const centreId = centre ?? ALL_CENTRES;
  const baseFilter = showSwitcher ? { centreId, pageSize: 100 } : { pageSize: 100 };

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery({
    queryKey: tasksQueryKeys.list(baseFilter),
    queryFn: async () => {
      const claimsForFetch = await assertAuthenticated(supabase);
      return listTasksCore(supabase, claimsForFetch, baseFilter);
    },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CalendarBoard role={claims.role} departments={departments} />
    </HydrationBoundary>
  );
}
