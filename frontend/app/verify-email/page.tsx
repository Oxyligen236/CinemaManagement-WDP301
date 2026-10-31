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

/**
 * Khớp `RESEND_COOLDOWN_MS` của backend, chỉ dùng làm giá trị khởi tạo trong lúc
 * chờ `GET /auth/verification-status`: thà chặn nút sớm hơn một nhịp còn hơn bật
 * nút rồi chắc chắn bị backend trả 429.
 */
const RESEND_COOLDOWN_SECONDS = 60;

/** Thời gian giữ banner thành công trước khi chuyển sang trang đăng nhập. */
const SUCCESS_REDIRECT_DELAY_MS = 2500;

type VerifyResponse = {
  message?: string;
};

type VerificationStatusResponse = {
  pending?: boolean;
  resendAvailableInSeconds?: number;
};

type ResendResponse = VerifyResponse & {
  resendAvailableInSeconds?: number;
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

/**
 * Đọc số giây còn lại trước khi được gửi lại mã, theo trạng thái thật trên server.
 *
 * Đăng ký chờ xác thực nằm trong bộ nhớ của backend, nên đây là nguồn duy nhất
 * biết mã đã gửi còn hiệu lực hay không và cooldown còn bao lâu. Nhờ vậy người
 * dùng thoát khỏi màn hình xác thực rồi quay lại không bị đếm lại từ đầu.
 *
 * @returns Số giây còn lại, `0` khi không còn đăng ký nào chờ xác thực (mã đã
 * hết hạn) để người dùng xin được mã mới ngay, hoặc `null` khi không đọc được
 * trạng thái — khi đó giữ nguyên countdown đang hiển thị.
 */
async function fetchResendCooldown(email: string): Promise<number | null> {
  const trimmed = email.trim();
  if (!trimmed || validateEmail(trimmed)) return null;

  try {
    const response = await fetch(
      `${apiUrl}/auth/verification-status?email=${encodeURIComponent(trimmed)}`,
    );
    if (!response.ok) return null;

    const data = (await response
      .json()
      .catch(() => ({}))) as VerificationStatusResponse;

    if (data.pending === false) return 0;

    return Math.max(0, data.resendAvailableInSeconds ?? 0);
  } catch {
    return null;
  }
}

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialEmail = searchParams.get("email") ?? "";
  const [form, setForm] = useState<VerifyForm>({
    email: initialEmail,
    code: "",
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(
    // `pending=1`: người dùng đăng ký lại bằng email đang chờ xác thực, backend
    // giữ nguyên mã cũ nên phải nói rõ là không có email mới được gửi.
    searchParams.get("pending") === "1"
      ? "Email này đang chờ xác thực. Vui lòng nhập mã đã được gửi trước đó."
      : "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  // Khác rỗng = đã xác thực xong, đang chờ hết thời gian đọc thông báo để chuyển
  // sang trang đăng nhập. Cũng dùng để khóa form, tránh gửi lại mã cho một tài
  // khoản đã tạo xong.
  const [verifiedEmail, setVerifiedEmail] = useState("");
  // Khởi tạo bằng cooldown đầy đủ rồi thay bằng thời gian còn lại thật lấy từ
  // `GET /auth/verification-status`, để người dùng thoát trang rồi quay lại
  // không bị đếm lại từ 60 giây.
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

  useEffect(() => {
    let active = true;

    fetchResendCooldown(initialEmail).then((seconds) => {
      if (active && seconds !== null) setCooldown(seconds);
    });

    return () => {
      active = false;
    };
  }, [initialEmail]);

  /** Đã xác thực xong, đang chờ chuyển sang trang đăng nhập — derived, không phải state. */
  const verified = verifiedEmail !== "";

  useEffect(() => {
    if (!verifiedEmail) return;

    const timer = setTimeout(() => {
      router.push(`/login?email=${encodeURIComponent(verifiedEmail)}`);
    }, SUCCESS_REDIRECT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [router, verifiedEmail]);

  /** Lấy countdown thật từ server cho email đang nhập (ô email cho sửa được). */
  async function syncCooldown(email: string) {
    const seconds = await fetchResendCooldown(email);
    if (seconds !== null) setCooldown(seconds);
  }

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
      const data = (await response.json().catch(() => ({}))) as ResendResponse;

      if (!response.ok) {
        setError(
          getFriendlyErrorMessage(
            { status: response.status, message: data.message },
            "Không thể gửi lại mã xác thực.",
          ),
        );
        // Bị từ chối vì chưa hết cooldown: lấy lại thời gian còn lại thật thay
        // vì để nút tiếp tục bật và gửi thêm request chắc chắn thất bại.
        void syncCooldown(form.email);
        return;
      }

      setNotice("Đã gửi mã xác thực mới. Vui lòng kiểm tra hộp thư.");
      setForm((current) => ({ ...current, code: "" }));
      setCooldown(data.resendAvailableInSeconds ?? RESEND_COOLDOWN_SECONDS);
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

      // Điều hướng ngay thì banner thành công bị thay bằng trang đăng nhập
      // trước khi người dùng kịp đọc: hiện thông báo rồi mới chuyển trang.
      setNotice("Xác thực email thành công! Đang chuyển đến trang đăng nhập...");
      setVerifiedEmail(form.email.trim());
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
          onBlur={() => {
            validateField(form, "email");
            // Ô email cho sửa được, nên countdown phải theo đúng email đang nhập.
            // `syncCooldown` tự bỏ qua email không hợp lệ.
            void syncCooldown(form.email);
          }}
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
          disabled={submitting || resending || verified}
          className={AUTH_PRIMARY_BUTTON_CLASS}
        >
          {(submitting || verified) && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          )}
          {verified
            ? "Đang chuyển trang..."
            : submitting
              ? "Đang xác thực..."
              : "Xác thực Email"}
        </button>

        <div className="space-y-2">
          <button
            type="button"
            onClick={handleResend}
            disabled={submitting || resending || verified || cooldown > 0}
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
