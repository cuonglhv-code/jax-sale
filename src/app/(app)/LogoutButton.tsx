"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/app/actions/auth/sign-out";

/** Ends the session (FR-003) and returns to /login, refreshing the router cache. */
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
      className="rounded px-2 py-1 text-left text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50"
    >
      {submitting ? "Đang đăng xuất..." : "Đăng xuất"}
    </button>
  );
}
