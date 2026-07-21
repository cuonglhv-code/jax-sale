"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions/auth/sign-out";
import { LogOutIcon } from "./nav-icons";

/** Ends the session (FR-003) and returns to /login, refreshing the router cache. Icon-only button
 *  in the sidebar footer (design_handoff_jax_sales). */
export function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setSubmitting(true);
    await signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={submitting}
      title="Đăng xuất"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sidebar-text transition-colors hover:bg-sidebar-hover hover:text-white disabled:opacity-50"
    >
      <LogOutIcon />
    </button>
  );
}
