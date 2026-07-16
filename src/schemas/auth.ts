import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(1, "Vui lòng nhập mật khẩu"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const requestPasswordResetSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
});
export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Mật khẩu phải có ít nhất 8 ký tự"),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
