/** Lucide-style inline SVGs for the sidebar nav (stroke-width 1.5-1.6, per design_handoff_jax_sales
 *  README's icon list). Kept as plain SVG rather than a dependency — the app has no icon library
 *  yet and this set is small/fixed. */

const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...common} className="shrink-0">
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
    </svg>
  );
}

export function CheckSquareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...common} className="shrink-0">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="m8 12 2.5 2.5L16 9" />
    </svg>
  );
}

export function TrendingUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...common} className="shrink-0">
      <path d="M3 17l6-6 4 4 8-8M17 7h4v4" />
    </svg>
  );
}

export function MountainIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...common} className="shrink-0">
      <path d="m3 20 6-12 4 6 2-3 6 9z" />
    </svg>
  );
}

export function FileIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...common} className="shrink-0">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h4" />
    </svg>
  );
}

export function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...common} className="shrink-0">
      <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" />
      <path d="M22 4 12 14.02l-3-3" />
    </svg>
  );
}

export function CalendarIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...common} className="shrink-0">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

export function ChartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...common} className="shrink-0">
      <path d="M3 3v18h18M7 16v-5M12 16V8M17 16v-7" />
    </svg>
  );
}

export function LogOutIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" {...common} className="shrink-0">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  );
}
