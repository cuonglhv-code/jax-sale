"use client";

import type { SummitStage } from "@/services/ielts/summit-types";
import { StagePanel } from "./StagePanel";

type Props = {
  stage: SummitStage | null;
  onClose: () => void;
};

/**
 * Right-side sliding drawer for stage detail (Summit redesign 2026-07): the racecourse hero
 * shrinks to make room; StagePanel's content is unchanged, only the surrounding chrome differs
 * from the former fixed side-column placement. Renders nothing when no stage is open so the
 * caller doesn't need a separate `expandedStage &&` guard.
 */
export function StageDrawer({ stage, onClose }: Props) {
  if (!stage) return null;

  return (
    <div
      role="dialog"
      aria-label={stage.name}
      className="fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto p-4 shadow-2xl transition-transform duration-300 motion-reduce:transition-none"
      style={{ backgroundColor: "transparent" }}
    >
      <StagePanel stage={stage} onClose={onClose} />
    </div>
  );
}
