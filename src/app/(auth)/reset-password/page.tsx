"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/app/actions/auth/request-password-reset";
import { resetPassword } from "@/app/actions/auth/reset-password";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function handleRequest(e: React.FormEvent) {
    e.preventDefault();
    await requestPasswordReset({ email });
    setMessage("Nếu email tồn tại, một liên kết đặt lại mật khẩu đã được gửi.");
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    const result = await resetPassword({ newPassword });
    setMessage("error" in result ? result.error : "Đặt lại mật khẩu thành công. Vui lòng đăng nhập.");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold">Đặt lại mật khẩu</h1>

      <form onSubmit={handleRequest} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
          Gửi liên kết đặt lại
        </button>
      </form>

      <form onSubmit={handleReset} className="flex flex-col gap-4 border-t pt-6">
        <label className="flex flex-col gap-1 text-sm">
          Mật khẩu mới
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="rounded border px-3 py-2"
          />
        </label>
        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white">
          Đặt mật khẩu mới
        </button>
      </form>

      {message && <p className="text-sm">{message}</p>}
    </main>
  );
}
