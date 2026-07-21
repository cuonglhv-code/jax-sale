"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ALL_CENTRES, ALL_CENTRES_LABEL } from "@/lib/domain/vocabulary";

interface CentreOption {
  id: string;
  name: string;
}

/** Only rendered for network-wide roles (super_admin) — see Sidebar.tsx's gate. Reads/writes the
 *  shared `?centre=` URL param so every page (Tasks, KPI, HR Reports) filters consistently without
 *  a shared client-side store — a server component just reads `searchParams.centre`. */
export function CentreSwitcher({ centres }: { centres: CentreOption[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeId = searchParams.get("centre") ?? ALL_CENTRES;
  const activeName = activeId === ALL_CENTRES ? ALL_CENTRES_LABEL : (centres.find((c) => c.id === activeId)?.name ?? ALL_CENTRES_LABEL);

  function select(id: string) {
    const params = new URLSearchParams(searchParams);
    if (id === ALL_CENTRES) params.delete("centre");
    else params.set("centre", id);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    setIsOpen(false);
  }

  return (
    <div className="relative px-3 pb-3.5">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center gap-[9px] rounded-lg border border-sidebar-border bg-sidebar-active px-[11px] py-[9px] text-left text-white"
      >
        <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[7px] bg-red text-white">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[9px] uppercase tracking-[.13em] text-sidebar-text opacity-75">Trung tâm</span>
          <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold">{activeName}</span>
        </span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 top-full z-40 mt-1 overflow-hidden rounded-[10px] border border-border bg-surface p-[5px] shadow-lg">
          <button
            type="button"
            onClick={() => select(ALL_CENTRES)}
            className={`flex w-full items-center justify-between gap-2 rounded-[7px] px-[11px] py-[9px] text-left text-[13px] transition-colors hover:bg-surface-3 ${
              activeId === ALL_CENTRES ? "font-semibold text-navy" : "font-medium text-text"
            }`}
          >
            <span>{ALL_CENTRES_LABEL}</span>
            {activeId === ALL_CENTRES && <CheckIcon />}
          </button>
          {centres.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => select(c.id)}
              className={`flex w-full items-center justify-between gap-2 rounded-[7px] px-[11px] py-[9px] text-left text-[13px] transition-colors hover:bg-surface-3 ${
                activeId === c.id ? "font-semibold text-navy" : "font-medium text-text"
              }`}
            >
              <span>{c.name}</span>
              {activeId === c.id && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-navy)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
