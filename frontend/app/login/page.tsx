"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import {
  AuthShell,
  AuthErrorBanner,
  AUTH_PRIMARY_BUTTON_CLASS,
} from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-field";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";
import { useFormErrors, type FieldErrors } from "@/lib/utils/use-form-errors";
import { validateEmail, validatePassword } from "@/lib/utils/auth-validation";

type LoginForm = {
  email: string;
  password: string;
};

function getRedirectPathByRole(role?: string): string {
  const normalizedRole = role?.toUpperCase();
  if (normalizedRole === "ADMIN") return "/admin/dashboard";
  if (normalizedRole === "MANAGER") return "/manager";
  if (normalizedRole === "STAFF") return "/staff/pos";
  return "/";
}

/**
 * Khớp với ràng buộc `LoginDto` của backend.
 * `LoginDto` không có `@MaxLength`, nên không chặn mật khẩu dài.
 */
function validateLoginForm(form: LoginForm): FieldErrors<LoginForm> {
  const errors: FieldErrors<LoginForm> = {};

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  const password = validatePassword(form.password, {
    enforceMaxLength: false,
  });
  if (password) errors.password = password;

  return errors;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<LoginForm>({
    email: searchParams.get("email") ?? "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { fieldErrors, clearFieldError, validateField, validateAll } =
    useFormErrors<LoginForm>(
      useCallback((values: LoginForm) => validateLoginForm(values), []),
    );

  useEffect(() => {
    const token = localStorage.getItem("cinema_access_token");
    const rawUser = localStorage.getItem("cinema_user");
    if (token && rawUser) {
      try {
        const user = JSON.parse(rawUser) as { role?: string };
        router.replace(getRedirectPathByRole(user.role));
      } catch {
        localStorage.removeItem("cinema_access_token");
        localStorage.removeItem("cinema_user");
      }
    }
  }, [router]);

  function updateField(field: keyof LoginForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validateAll(form)) return;

    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getFriendlyErrorMessage(
            { status: response.status, message: result.message },
            "Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin.",
          ),
        );
      }

      localStorage.setItem("cinema_access_token", result.accessToken);
      localStorage.setItem("cinema_user", JSON.stringify(result.user));
      router.replace(getRedirectPathByRole(result.user?.role));
    } catch (submitError) {
      setError(
        getFriendlyErrorMessage(
          submitError,
          "Không thể đăng nhập. Vui lòng thử lại sau.",
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="ĐĂNG NHẬP HỆ THỐNG"
      title="Chào mừng trở lại"
      panelTitle="Thông tin Đăng nhập"
      panelAside="Bắt buộc"
      icon={LogIn}
      footerSlot={
        <p className="text-center text-[13px] text-[#666]">
          Chưa có tài khoản?{" "}
          <Link
            href="/register"
            className="font-bold text-[#da291c] hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="login-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={(value) => updateField("email", value)}
          onBlur={() => validateField(form, "email")}
          placeholder="you@example.com"
          autoComplete="email"
          error={fieldErrors.email}
        />

        <AuthField
          id="login-password"
          label="Mật khẩu"
          type="password"
          value={form.password}
          onChange={(value) => updateField("password", value)}
          onBlur={() => validateField(form, "password")}
          autoComplete="current-password"
          error={fieldErrors.password}
        >
          <div className="mt-2 flex justify-end">
            <Link
              href="/forgot-password"
              className="text-[12px] font-bold text-[#da291c] hover:underline"
            >
              Quên mật khẩu?
            </Link>
          </div>
        </AuthField>

        {error && <AuthErrorBanner message={error} />}

        <button
          type="submit"
          disabled={isSubmitting}
          className={AUTH_PRIMARY_BUTTON_CLASS}
        >
          {isSubmitting && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          )}
          {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
