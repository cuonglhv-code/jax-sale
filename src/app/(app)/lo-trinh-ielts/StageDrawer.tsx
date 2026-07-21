"use client";

import { useEffect, useState } from "react";
import type { SummitStage } from "@/services/ielts/summit-types";
import { StagePanel } from "./StagePanel";

type Props = {
  stage: SummitStage | null;
  onClose: () => void;
};

/** Drawer close animation duration — must match the `duration-300` Tailwind class below. */
const CLOSE_ANIMATION_MS = 300;

/**
 * Right-side sliding drawer for stage detail (Summit redesign 2026-07): the racecourse hero
 * shrinks to make room; StagePanel's content is unchanged, only the surrounding chrome differs
 * from the former fixed side-column placement.
 *
 * Mounted/open pattern: `renderedStage` state remembers the last non-null stage so `StagePanel`
 * keeps rendering real content while the drawer slides out, even after `stage` itself has gone
 * null. Both `renderedStage` and `hasEnteredFrame` are updated during render (the
 * "adjusting state when a prop changes" pattern, not an effect) whenever a new non-null `stage`
 * arrives — this avoids any synchronous setState call inside an effect body. A `setTimeout`
 * scheduled from the effect below clears `renderedStage` back to null once the close transition
 * has had time to play, so the drawer actually leaves the DOM only after `CLOSE_ANIMATION_MS`.
 *
 * `isTranslatedIn` is derived from `stage !== null && hasEnteredFrame`, so it is forced `false`
 * the instant `stage` goes null with no extra state write. `hasEnteredFrame` itself only flips to
 * `true` one frame after mount (scheduled via `requestAnimationFrame`, an event-like callback —
 * not a synchronous effect-body write) so the browser first observes `translate-x-full` before
 * transitioning to `translate-x-0`.
 */
export function StageDrawer({ stage, onClose }: Props) {
  const [renderedStage, setRenderedStage] = useState<SummitStage | null>(stage);
  const [hasEnteredFrame, setHasEnteredFrame] = useState(false);

  // Adjust state during render when a new stage opens (React-recommended alternative to an
  // effect for "derive state from a prop change") — keeps renderedStage in sync, and re-arms
  // hasEnteredFrame so a re-open replays the slide-in instead of skipping straight to
  // translate-x-0, without any synchronous setState-in-effect.
  if (stage && stage !== renderedStage) {
    setRenderedStage(stage);
    setHasEnteredFrame(false);
  }

  const isTranslatedIn = stage !== null && hasEnteredFrame;

  useEffect(() => {
    if (!stage) {
      const timeout = setTimeout(() => setRenderedStage(null), CLOSE_ANIMATION_MS);
      return () => clearTimeout(timeout);
    }

    const raf = requestAnimationFrame(() => setHasEnteredFrame(true));
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  useEffect(() => {
    if (!stage) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stage, onClose]);

  if (!renderedStage) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={renderedStage.name}
      className={`fixed inset-y-0 right-0 z-30 w-full max-w-md overflow-y-auto p-4 shadow-2xl transition-transform duration-300 motion-reduce:transition-none ${
        isTranslatedIn ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ backgroundColor: "transparent" }}
    >
      <StagePanel stage={renderedStage} onClose={onClose} />
    </div>
  );
}
