"use client";

import { useMyCoverNominations } from "@/hooks/queries/hr/useMyCoverNominations";
import { useRespondCover } from "@/hooks/mutations/hr/useRespondCover";

/**
 * US4 (T043): a teacher's pending cover nominations — accept/decline inline. Minimal UI, matching
 * the rest of this slice's plain-list style (no dialog library).
 */
export function MyCoverNominations() {
  const { data, isLoading, error } = useMyCoverNominations();
  const respond = useRespondCover();

  if (isLoading) return null;
  if (error) return <p className="text-sm text-red-600">{error.message}</p>;
  if (!data || data.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium">Đề cử dạy thay đang chờ bạn xác nhận</h2>
      {respond.error && <p className="text-sm text-red-600">{respond.error.message}</p>}
      {data.map((cover) => (
        <div key={cover.id} className="flex flex-wrap items-center gap-2 rounded border p-3 text-sm">
          <span>Buổi học ngày {cover.sessionDate}</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="rounded bg-green-600 px-3 py-1 text-white disabled:opacity-50"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ coverId: cover.id, accept: true })}
            >
              Nhận dạy thay
            </button>
            <button
              type="button"
              className="rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
              disabled={respond.isPending}
              onClick={() => respond.mutate({ coverId: cover.id, accept: false })}
            >
              Từ chối
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
