"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface NavLinkProps {
  href: string;
  label: string;
  icon: ReactNode;
  count?: number;
}

/** Sidebar nav item. Active state = the "checkpoint tick" (a 3px red bar at the left edge that
 *  animates its height in) + filled background + white text, per the design handoff's signature
 *  element (design_handoff_jax_sales/README.md "SIGNATURE"). */
export function NavLink({ href, label, icon, count }: NavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`relative flex items-center gap-[11px] rounded-lg px-3 py-[9px] text-[13.5px] transition-colors ${
        isActive
          ? "bg-sidebar-active font-semibold text-sidebar-text-active"
          : "font-medium text-sidebar-text hover:bg-sidebar-hover hover:text-sidebar-text-active"
      }`}
    >
      <span
        className="absolute left-0 top-1/2 w-[3px] -translate-y-1/2 rounded-r-[3px] bg-red transition-[height] duration-150"
        style={{ height: isActive ? "20px" : "0" }}
      />
      {icon}
      <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{label}</span>
      {!!count && (
        <span className="flex h-[19px] min-w-[19px] items-center justify-center rounded-full bg-red px-[5px] text-[10.5px] font-bold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
