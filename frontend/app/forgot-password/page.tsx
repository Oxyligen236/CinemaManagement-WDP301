"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, KeyRound, RotateCcw } from "lucide-react";
import {
  AuthShell,
  AuthErrorBanner,
  AuthSuccessBanner,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
} from "@/components/auth/auth-shell";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type ApiResponse = {
  message?: string;
};

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function requestResetCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Không thể yêu cầu mã đặt lại.",
        );
      }

      setMessage(
        "Nếu email này đã được đăng ký, mã đặt lại đã được gửi. Vui lòng kiểm tra hộp thư của bạn.",
      );
      setStep("reset");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Không thể kết nối đến máy chủ.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (code.length !== 6) {
      setError("Mã xác thực phải gồm đúng 6 chữ số.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Mật khẩu mới phải có tối thiểu 8 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          code,
          newPassword,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Mã đặt lại không hợp lệ hoặc đã hết hạn.",
        );
      }

      router.push(`/login?email=${encodeURIComponent(email)}`);
    } catch (resetError) {
      setError(
        resetError instanceof Error
          ? resetError.message
          : "Không thể đặt lại mật khẩu của bạn.",
      );
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
          : "Nhập mã 6 chữ số đã được gửi đến email của bạn. Mã có hiệu lực trong 5 phút."
      }
      panelTitle={isRequestStep ? "Yêu cầu Mã Đặt lại" : "Đặt lại Mật khẩu Mới"}
      panelAside={isRequestStep ? "Bước 1 / 2" : "Bước 2 / 2"}
      icon={KeyRound}
      maxWidthClass="max-w-[520px]"
      footerSlot={
        <p className="text-center text-[13px] text-[#666]">
          Đã nhớ mật khẩu?{" "}
          <Link href="/login" className="font-bold text-[#da291c] hover:underline">
            Quay lại Đăng nhập
          </Link>
        </p>
      }
    >
      {isRequestStep ? (
        <form className="space-y-4" onSubmit={requestResetCode}>
          <div>
            <label htmlFor="forgot-email" className={AUTH_LABEL_CLASS}>
              Email
            </label>
            <input
              id="forgot-email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={AUTH_INPUT_CLASS}
            />
          </div>
          {error && <AuthErrorBanner message={error} />}
          <button type="submit" disabled={submitting} className={AUTH_PRIMARY_BUTTON_CLASS}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
            {submitting ? "Đang gửi mã..." : "Gửi mã đặt lại"}
          </button>
        </form>
      ) : (
        <>
          {message && <AuthSuccessBanner message={message} />}

          <form className="mt-4 space-y-4" onSubmit={resetPassword}>
            <div>
              <label htmlFor="reset-email" className={AUTH_LABEL_CLASS}>
                Email
              </label>
              <input
                id="reset-email"
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                className={AUTH_INPUT_CLASS}
              />
            </div>

            <div>
              <label htmlFor="reset-code" className={AUTH_LABEL_CLASS}>
                Mã đặt lại
              </label>
              <input
                id="reset-code"
                required
                minLength={6}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]{6}"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                autoComplete="one-time-code"
                aria-describedby="reset-code-hint"
                className={`${AUTH_INPUT_CLASS} text-center text-[20px] font-bold tracking-[0.4em]`}
              />
              <p id="reset-code-hint" className="mt-1 text-[11px] text-[#777]">
                Gồm đúng 6 chữ số.
              </p>
            </div>

            <div>
              <label htmlFor="reset-new-password" className={AUTH_LABEL_CLASS}>
                Mật khẩu mới
              </label>
              <input
                id="reset-new-password"
                required
                minLength={8}
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="Tối thiểu 8 ký tự"
                autoComplete="new-password"
                aria-describedby="reset-new-password-hint"
                className={AUTH_INPUT_CLASS}
              />
              <p id="reset-new-password-hint" className="mt-1 text-[11px] text-[#777]">
                Tối thiểu 8 ký tự.
              </p>
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className={AUTH_LABEL_CLASS}>
                Xác nhận mật khẩu mới
              </label>
              <input
                id="reset-confirm-password"
                required
                minLength={8}
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                className={AUTH_INPUT_CLASS}
              />
            </div>

            {error && <AuthErrorBanner message={error} />}

            <button type="submit" disabled={submitting} className={AUTH_PRIMARY_BUTTON_CLASS}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
              {submitting ? "Đang đặt lại mật khẩu..." : "Đặt lại mật khẩu"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setStep("request");
              setCode("");
              setNewPassword("");
              setConfirmPassword("");
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
