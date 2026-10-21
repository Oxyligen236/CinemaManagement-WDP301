"use client";

import Link from "next/link";
import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
  AuthErrorBanner,
  AuthShell,
} from "@/components/auth/auth-shell";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type VerifyResponse = {
  message?: string;
};

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const data = (await response.json().catch(() => ({}))) as VerifyResponse;

      if (!response.ok) {
        throw new Error(
          typeof data.message === "string"
            ? data.message
            : "Mã xác thực không hợp lệ hoặc đã hết hạn.",
        );
      }

      router.push(`/login?email=${encodeURIComponent(email)}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Không thể kết nối đến máy chủ.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      eyebrow="XÁC THỰC EMAIL"
      title="Kiểm tra hộp thư của bạn"
      description="Nhập mã 6 chữ số đã được gửi đến email của bạn. Mã có hiệu lực trong 5 phút."
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
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="verify-email" className={AUTH_LABEL_CLASS}>
            Email
          </label>
          <input
            id="verify-email"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <div>
          <label htmlFor="verify-code" className={AUTH_LABEL_CLASS}>
            Mã xác thực
          </label>
          <input
            id="verify-code"
            required
            minLength={6}
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]{6}"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, ""))
            }
            placeholder="000000"
            autoComplete="one-time-code"
            aria-describedby="verify-code-hint"
            className={`${AUTH_INPUT_CLASS} text-center text-[20px] font-bold tracking-[0.4em]`}
          />
          <p id="verify-code-hint" className="mt-1 text-[11px] text-[#777]">
            Gồm đúng 6 chữ số, không chứa khoảng trắng.
          </p>
        </div>

        {error && <AuthErrorBanner message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className={AUTH_PRIMARY_BUTTON_CLASS}
        >
          {submitting && (
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
          )}
          {submitting ? "Đang xác thực..." : "Xác thực Email"}
        </button>
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
