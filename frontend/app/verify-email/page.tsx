"use client";

import Link from "next/link";
import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import {
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
  AuthErrorBanner,
  AuthShell,
  AuthSuccessBanner,
} from "@/components/auth/auth-shell";
import { AuthField } from "@/components/auth/auth-field";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";
import { useFormErrors, type FieldErrors } from "@/lib/utils/use-form-errors";
import {
  VERIFICATION_CODE_LENGTH,
  validateEmail,
  validateVerificationCode,
} from "@/lib/utils/auth-validation";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

/** Khớp `RESEND_COOLDOWN_MS` của backend để nút không bật trước khi được phép. */
const RESEND_COOLDOWN_SECONDS = 60;

type VerifyResponse = {
  message?: string;
};

type VerifyForm = {
  email: string;
  code: string;
};

/** Khớp với ràng buộc `VerifyEmailDto` của backend. */
function validateVerifyForm(form: VerifyForm): FieldErrors<VerifyForm> {
  const errors: FieldErrors<VerifyForm> = {};

  const email = validateEmail(form.email);
  if (email) errors.email = email;

  const code = validateVerificationCode(form.code);
  if (code) errors.code = code;

  return errors;
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<VerifyForm>({
    email: searchParams.get("email") ?? "",
    code: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Người dùng vừa tới từ `/register` nên mã đầu tiên vừa được gửi: khởi động
  // cooldown luôn để không gọi API chắc chắn bị backend trả 429.
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const { fieldErrors, clearFieldError, validateField, validateAll } =
    useFormErrors<VerifyForm>(
      useCallback((values: VerifyForm) => validateVerifyForm(values), []),
    );

  useEffect(() => {
    if (cooldown <= 0) return;

    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);

    return () => clearTimeout(timer);
  }, [cooldown]);

  function updateField(field: keyof VerifyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    clearFieldError(field);
  }

  async function handleResend() {
    setError("");
    setNotice("");

    const emailError = validateEmail(form.email);
    if (emailError) {
      validateField(form, "email");
      return;
    }

    setResending(true);

    try {
      const response = await fetch(`${apiUrl}/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim() }),
      });
      const data = (await response.json().catch(() => ({}))) as VerifyResponse;

      if (!response.ok) {
        setError(
          getFriendlyErrorMessage(
            { status: response.status, message: data.message },
            "Không thể gửi lại mã xác thực.",
          ),
        );
        return;
      }

      setNotice("Đã gửi mã xác thực mới. Vui lòng kiểm tra hộp thư.");
      setForm((current) => ({ ...current, code: "" }));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!validateAll(form)) return;

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email.trim(),
          code: form.code.trim(),
        }),
      });
      const data = (await response.json().catch(() => ({}))) as VerifyResponse;

      if (!response.ok) {
        setError(
          getFriendlyErrorMessage(
            { status: response.status, message: data.message },
            "Mã xác thực không hợp lệ hoặc đã hết hạn.",
          ),
        );
        return;
      }

      router.push(`/login?email=${encodeURIComponent(form.email.trim())}`);
    } catch {
      setError("Không thể kết nối đến máy chủ. Vui lòng thử lại sau.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="XÁC THỰC EMAIL"
      title="Kiểm tra hộp thư của bạn"
      description={`Nhập mã ${VERIFICATION_CODE_LENGTH} chữ số đã được gửi đến email của bạn. Mã có hiệu lực trong 5 phút.`}
      panelTitle="Nhập Mã Xác thực"
      panelAside="Hiệu lực 5 phút"
      icon={MailCheck}
      footerSlot={
        <Link href="/login" className={AUTH_SECONDARY_BUTTON_CLASS}>
          <ArrowLeft className="h-4 w-4" />
          Quay lại Đăng nhập
        </Link>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        <AuthField
          id="verify-email"
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
          id="verify-code"
          label="Mã xác thực"
          value={form.code}
          onChange={(value) => updateField("code", value.replace(/\D/g, ""))}
          onBlur={() => validateField(form, "code")}
          maxLength={VERIFICATION_CODE_LENGTH}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          inputClassName="text-center text-[20px] font-bold tracking-[0.4em]"
          hint={`Gồm đúng ${VERIFICATION_CODE_LENGTH} chữ số, không chứa khoảng trắng.`}
          error={fieldErrors.code}
        />

        {error && <AuthErrorBanner message={error} />}
        {notice && <AuthSuccessBanner message={notice} />}

        <button
          type="submit"
          disabled={submitting || resending}
          className={AUTH_PRIMARY_BUTTON_CLASS}
        >
          {submitting && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          )}
          {submitting ? "Đang xác thực..." : "Xác thực Email"}
        </button>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={submitting || resending || cooldown > 0}
            className={AUTH_SECONDARY_BUTTON_CLASS}
          >
            {resending && (
              <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            )}
            {resending ? "Đang gửi lại..." : "Gửi lại mã"}
          </button>
          <p
            aria-live="polite"
            className="text-center text-[12px] text-[#6f6247]"
          >
            {cooldown > 0
              ? `Có thể gửi lại sau ${cooldown} giây.`
              : "Không nhận được mã? Bạn có thể gửi lại."}
          </p>
        </div>
      </form>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailForm />
    </Suspense>
  );
}
