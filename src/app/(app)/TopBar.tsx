"use client";

import { usePathname } from "next/navigation";
import { pageMetaForRoute } from "@/lib/domain/vocabulary";
import { ThemeToggle } from "./ThemeToggle";

/** Shell top bar: breadcrumb + page title (derived from the route via the same NAV_ITEMS labels
 *  every page's nav entry already carries — no per-page title prop needed), search (visual only —
 *  not wired to a global search index yet), notification bell, theme toggle. 64px per
 *  design_handoff_jax_sales. */
export function TopBar() {
  const pathname = usePathname();
  const { pageTitle, crumb } = pageMetaForRoute(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border bg-surface px-6">
      <div className="min-w-0">
        <div className="text-[11px] tracking-[.02em] text-text-faint">{crumb}</div>
        <h1 className="m-0 whitespace-nowrap text-[19px] font-bold leading-[1.15] tracking-[-.01em] text-text">{pageTitle}</h1>
      </div>
      <div className="flex-1" />
      <div className="relative w-[280px] max-w-[32vw]">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--color-text-faint)"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          placeholder="Tìm công việc, nhân viên…"
          className="h-[38px] w-full rounded-[var(--radius-field)] border border-border bg-surface-2 pl-[34px] pr-3 text-[13px] text-text outline-none transition-[border-color,box-shadow] focus:border-navy focus:shadow-[0_0_0_3px_var(--color-navy-tint)]"
        />
      </div>
      <button
        title="Thông báo"
        type="button"
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[var(--radius-field)] border border-border bg-surface-2 text-text-muted transition-colors hover:border-border-strong hover:bg-surface-3"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          <path d="M21 8a2 2 0 0 0-2-2 5 5 0 0 0-5-5 5 5 0 0 0-5 5 2 2 0 0 0-2 2c0 7-3 9-3 9h20s-3-2-3-9" />
        </svg>
        <span className="absolute right-[9px] top-2 h-[7px] w-[7px] rounded-full border-[1.5px] border-surface bg-red" />
      </button>
      <ThemeToggle />
    </header>
  );
}
