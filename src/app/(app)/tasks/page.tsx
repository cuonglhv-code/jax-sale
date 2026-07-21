import { QueryClient, dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getVerifiedClaims } from "@/lib/auth/claims";
import { assertAuthenticated } from "@/lib/auth/assert-permission";
import { listTasksCore } from "@/services/task.service";
import { tasksQueryKeys } from "@/hooks/queries/useTasks";
import { ALL_CENTRES, isNetworkWideRole } from "@/lib/domain/vocabulary";
import { TasksBoard } from "./TasksBoard";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ centre?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const claims = await getVerifiedClaims(supabase);

  // Centre switcher lives in the app shell now (Sidebar/CentreSwitcher, layout.tsx) — this page
  // only needs the department list for CreateTaskDrawer.
  const departments = (await supabase.from("departments").select("id, name").order("name")).data ?? [];

  // Mirrors TasksBoard's own filter derivation (centreId from ?centre=, no status on first
  // mount) so the prefetched query key matches exactly what the client requests — otherwise
  // React Query treats it as a cache miss and refetches anyway, defeating the prefetch.
  const { centre } = await searchParams;
  const showSwitcher = isNetworkWideRole(claims.role);
  const centreId = centre ?? ALL_CENTRES;
  const baseFilter = showSwitcher ? { centreId } : {};

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
      <TasksBoard role={claims.role} departments={departments} />
    </HydrationBoundary>
  );
}
