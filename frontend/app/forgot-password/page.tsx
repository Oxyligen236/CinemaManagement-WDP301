"use client";

import Link from "next/link";
import { FormEvent, useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound, RotateCcw } from "lucide-react";
import {
  AuthShell,
  AuthErrorBanner,
  AuthSuccessBanner,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
} from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-field";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";
import { useFormErrors, type FieldErrors } from "@/lib/utils/use-form-errors";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  VERIFICATION_CODE_LENGTH,
  validateConfirmPassword,
  validateEmail,
  validatePassword,
  validateVerificationCode,
} from "@/lib/utils/auth-validation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type ApiResponse = {
  message?: string;
};

type RequestForm = {
  email: string;
};

type ResetForm = {
  email: string;
  code: string;
  newPassword: string;
  confirmPassword: string;
};

/** Khớp với ràng buộc `ForgotPasswordDto` của backend. */
function validateRequestForm(form: RequestForm): FieldErrors<RequestForm> {
  const errors: FieldErrors<RequestForm> = {};

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  return errors;
}

/** Khớp với ràng buộc `ResetPasswordDto` của backend. */
function validateResetForm(form: ResetForm): FieldErrors<ResetForm> {
  const errors: FieldErrors<ResetForm> = {};

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  const code = validateVerificationCode(form.code);
  if (code) errors.code = code;

  const newPassword = validatePassword(form.newPassword, {
    label: "Mật khẩu mới",
  });
  if (newPassword) errors.newPassword = newPassword;

  const confirmPassword = validateConfirmPassword(
    form.confirmPassword,
    form.newPassword,
  );
  if (confirmPassword) errors.confirmPassword = confirmPassword;

  return errors;
}

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [form, setForm] = useState<ResetForm>({
    email: "",
    code: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestErrors = useFormErrors<RequestForm>(
    useCallback((values: RequestForm) => validateRequestForm(values), []),
  );
  const resetErrors = useFormErrors<ResetForm>(
    useCallback((values: ResetForm) => validateResetForm(values), []),
  );

  function updateField(field: keyof ResetForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    resetErrors.clearFieldError(field);
    if (field === "email") requestErrors.clearFieldError("email");
    // Sửa mật khẩu mới thì lỗi "không khớp" của ô xác nhận không còn đúng nữa.
    if (field === "newPassword") resetErrors.clearFieldError("confirmPassword");
  }

  async function requestResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!requestErrors.validateAll({ email: form.email })) return;

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: form.email.trim() }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        setError(
          getFriendlyErrorMessage(
            { status: response.status, message: data.message },
            "Không thể yêu cầu mã đặt lại.",
          ),
        );
        return;
      }

      setMessage(
        "Nếu email này đã được đăng ký, mã đặt lại đã được gửi. Vui lòng kiểm tra hộp thư của bạn.",
      );
      setStep("reset");
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (!resetErrors.validateAll(form)) return;

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: form.email.trim(),
          code: form.code.trim(),
          newPassword: form.newPassword,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        setError(
          getFriendlyErrorMessage(
            { status: response.status, message: data.message },
            "Mã đặt lại không hợp lệ hoặc đã hết hạn.",
          ),
        );
        return;
      }

      router.push(`/login?email=${encodeURIComponent(form.email.trim())}`);
    } catch {
      setError("Không thể đặt lại mật khẩu của bạn. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  const isRequestStep = step === "request"; // derived, không phải state

  return (
    <AuthShell
      eyebrow="ĐẶT LẠI MẬT KHẨU"
      title="Quên mật khẩu"
      description={
        isRequestStep
          ? "Nhập email của bạn, chúng tôi sẽ gửi mã đặt lại mật khẩu."
          : `Nhập mã ${VERIFICATION_CODE_LENGTH} chữ số đã được gửi đến email của bạn. Mã có hiệu lực trong 5 phút.`
      }
      panelTitle={isRequestStep ? "Yêu cầu Mã Đặt lại" : "Đặt lại Mật khẩu Mới"}
      panelAside={isRequestStep ? "Bước 1 / 2" : "Bước 2 / 2"}
      icon={KeyRound}
      maxWidthClass="max-w-[520px]"
      footerSlot={
        <p className="text-center text-[13px] text-[#666]">
          Đã nhớ mật khẩu?{" "}
          <Link
            href="/login"
            className="font-bold text-[#da291c] hover:underline"
          >
            Quay lại Đăng nhập
          </Link>
        </p>
      }
    >
      {isRequestStep ? (
        <form className="space-y-4" onSubmit={requestResetCode} noValidate>
          <AuthField
            id="forgot-email"
            label="Email"
            type="email"
            value={form.email}
            onChange={(value) => updateField("email", value)}
            onBlur={() => requestErrors.validateField({ email: form.email }, "email")}
            placeholder="you@example.com"
            autoComplete="email"
            error={requestErrors.fieldErrors.email}
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
            {submitting ? "Đang gửi mã..." : "Gửi mã đặt lại"}
          </button>
        </form>
      ) : (
        <>
          {message && <AuthSuccessBanner message={message} />}

          <form className="mt-4 space-y-4" onSubmit={resetPassword} noValidate>
            <AuthField
              id="reset-email"
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => updateField("email", value)}
              onBlur={() => resetErrors.validateField(form, "email")}
              autoComplete="email"
              error={resetErrors.fieldErrors.email}
            />

            <AuthField
              id="reset-code"
              label="Mã đặt lại"
              value={form.code}
              onChange={(value) => updateField("code", value.replace(/\D/g, ""))}
              onBlur={() => resetErrors.validateField(form, "code")}
              maxLength={VERIFICATION_CODE_LENGTH}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              inputClassName="text-center text-[20px] font-bold tracking-[0.4em]"
              hint={`Gồm đúng ${VERIFICATION_CODE_LENGTH} chữ số.`}
              error={resetErrors.fieldErrors.code}
            />

            <AuthField
              id="reset-new-password"
              label="Mật khẩu mới"
              type="password"
              value={form.newPassword}
              onChange={(value) => updateField("newPassword", value)}
              onBlur={() => resetErrors.validateField(form, "newPassword")}
              maxLength={PASSWORD_MAX_LENGTH}
              autoComplete="new-password"
              placeholder={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự`}
              hint={`Tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`}
              error={resetErrors.fieldErrors.newPassword}
            />

            <AuthField
              id="reset-confirm-password"
              label="Xác nhận mật khẩu mới"
              type="password"
              value={form.confirmPassword}
              onChange={(value) => updateField("confirmPassword", value)}
              onBlur={() => resetErrors.validateField(form, "confirmPassword")}
              maxLength={PASSWORD_MAX_LENGTH}
              autoComplete="new-password"
              placeholder="Nhập lại mật khẩu mới"
              error={resetErrors.fieldErrors.confirmPassword}
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
              {submitting ? "Đang đặt lại mật khẩu..." : "Đặt lại mật khẩu"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setStep("request");
              setForm((current) => ({
                ...current,
                code: "",
                newPassword: "",
                confirmPassword: "",
              }));
              resetErrors.setFieldErrors({});
              requestErrors.setFieldErrors({});
              setMessage("");
              setError("");
            }}
            className={`${AUTH_SECONDARY_BUTTON_CLASS} mt-4`}
          >
            <RotateCcw className="h-4 w-4" />
            Yêu cầu mã khác
          </button>
        </>
      )}
    </AuthShell>
  );
}
