"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import {
  AuthShell,
  AuthErrorBanner,
  AUTH_PRIMARY_BUTTON_CLASS,
} from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-field";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";
import { useFormErrors, type FieldErrors } from "@/lib/utils/use-form-errors";
import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateConfirmPassword,
  validateEmail,
  validateName,
  validatePassword,
} from "@/lib/utils/auth-validation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type RegisterResponse = {
  email?: string;
  message?: string;
  /**
   * Backend trả `true` khi email này đã có đăng ký đang chờ xác thực: mã cũ vẫn
   * còn hiệu lực nên không có mã mới được gửi.
   */
  alreadyPending?: boolean;
};

type RegisterForm = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

/**
 * Khớp với ràng buộc `RegisterDto` của backend.
 *
 */
function validateRegisterForm(form: RegisterForm): FieldErrors<RegisterForm> {
  const errors: FieldErrors<RegisterForm> = {};

  const firstName = validateName(form.firstName, "Tên");
  if (firstName) errors.firstName = firstName;

  const lastName = validateName(form.lastName, "Họ");
  if (lastName) errors.lastName = lastName;

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  const password = validatePassword(form.password);
  if (password) errors.password = password;

  const confirmPassword = validateConfirmPassword(
    form.confirmPassword,
    form.password,
  );
  if (confirmPassword) errors.confirmPassword = confirmPassword;

  return errors;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { fieldErrors, clearFieldError, validateField, validateAll } =
    useFormErrors<RegisterForm>(
      useCallback((values: RegisterForm) => validateRegisterForm(values), []),
    );

  function updateField(field: keyof RegisterForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
    if (field === "password") clearFieldError("confirmPassword");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!validateAll(form)) return;

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          email: form.email.trim(),
          password: form.password,
        }),
      });
      const data = (await response
        .json()
        .catch(() => ({}))) as RegisterResponse;

      if (!response.ok) {
        // Không bọc lại thành `Error` rồi dịch lần hai: chạy message đã dịch
        // qua `getFriendlyErrorMessage` một lần nữa có thể khớp sai nhánh và
        // trả về thông báo của nghiệp vụ khác.
        setError(
          getFriendlyErrorMessage(
            { status: response.status, message: data.message },
            "Không thể tạo tài khoản của bạn.",
          ),
        );
        return;
      }

      // Cả hai trường hợp (mã vừa gửi, hoặc email đang chờ xác thực từ lần đăng
      // ký trước) đều dẫn sang màn hình xác thực; trang đó tự đọc thời gian còn
      // lại thật từ API nên không cần truyền countdown qua URL.
      const email = data.email ?? form.email.trim();
      const pendingFlag = data.alreadyPending ? "&pending=1" : "";
      router.push(
        `/verify-email?email=${encodeURIComponent(email)}${pendingFlag}`,
      );
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="ĐĂNG KÝ THÀNH VIÊN"
      title="Tạo tài khoản mới"
      description="Nhập thông tin của bạn. Chúng tôi sẽ gửi mã xác thực đến email."
      panelTitle="Thông tin Tài khoản"
      icon={UserPlus}
      maxWidthClass="max-w-[560px]"
      footerSlot={
        <p className="text-center text-[13px] text-[#666]">
          Đã có tài khoản?{" "}
          <Link
            href="/login"
            className="font-bold text-[#da291c] hover:underline"
          >
            Đăng nhập
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField
            id="register-firstname"
            label="Tên"
            value={form.firstName}
            onChange={(value) => updateField("firstName", value)}
            onBlur={() => validateField(form, "firstName")}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="given-name"
            error={fieldErrors.firstName}
          />
          <AuthField
            id="register-lastname"
            label="Họ"
            value={form.lastName}
            onChange={(value) => updateField("lastName", value)}
            onBlur={() => validateField(form, "lastName")}
            maxLength={NAME_MAX_LENGTH}
            autoComplete="family-name"
            error={fieldErrors.lastName}
          />
        </div>

        <AuthField
          id="register-email"
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
          id="register-password"
          label="Mật khẩu"
          type="password"
          value={form.password}
          onChange={(value) => updateField("password", value)}
          onBlur={() => validateField(form, "password")}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          hint={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`}
          error={fieldErrors.password}
        />

        <AuthField
          id="register-confirm-password"
          label="Xác nhận mật khẩu"
          type="password"
          value={form.confirmPassword}
          onChange={(value) => updateField("confirmPassword", value)}
          onBlur={() => validateField(form, "confirmPassword")}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          placeholder="Nhập lại mật khẩu"
          error={fieldErrors.confirmPassword}
        />

        {error && <AuthErrorBanner message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className={AUTH_PRIMARY_BUTTON_CLASS}
        >
          {submitting && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          )}
          {submitting ? "Đang gửi mã..." : "Tiếp tục"}
        </button>
      </form>
    </AuthShell>
  );
}
