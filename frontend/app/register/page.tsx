"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import {
  AuthShell,
  AuthErrorBanner,
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_PRIMARY_BUTTON_CLASS,
} from "@/components/auth/auth-shell";
import { getFriendlyErrorMessage } from "@/lib/utils/error-handler";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010";

type RegisterResponse = {
  email?: string;
  message?: string;
};

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = (await response
        .json()
        .catch(() => ({}))) as RegisterResponse;

      if (!response.ok) {
        throw new Error(
          getFriendlyErrorMessage(
            { status: response.status, message: data.message },
            "Không thể tạo tài khoản của bạn.",
          ),
        );
      }

      const email = data.email ?? form.email;
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (submitError) {
      setError(
        getFriendlyErrorMessage(
          submitError,
          "Không thể kết nối đến máy chủ. Vui lòng thử lại sau.",
        ),
      );
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
      panelAside="Tất cả bắt buộc"
      icon={UserPlus}
      maxWidthClass="max-w-[560px]"
      footerSlot={
        <p className="text-center text-[13px] text-[#666]">
          Đã có tài khoản?{" "}
          <Link href="/login" className="font-bold text-[#da291c] hover:underline">
            Đăng nhập
          </Link>
        </p>
      }
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="register-firstname"
            label="Tên"
            value={form.firstName}
            onChange={(value) => updateField("firstName", value)}
          />
          <Field
            id="register-lastname"
            label="Họ"
            value={form.lastName}
            onChange={(value) => updateField("lastName", value)}
          />
        </div>
        <Field
          id="register-email"
          label="Email"
          type="email"
          value={form.email}
          onChange={(value) => updateField("email", value)}
        />
        <Field
          id="register-password"
          label="Mật khẩu"
          type="password"
          value={form.password}
          onChange={(value) => updateField("password", value)}
          hint="Tối thiểu 8 ký tự"
        />

        {error && <AuthErrorBanner message={error} />}

        <button type="submit" disabled={submitting} className={AUTH_PRIMARY_BUTTON_CLASS}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
          {submitting ? "Đang gửi mã..." : "Tiếp tục"}
        </button>
      </form>
    </AuthShell>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  hint,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className={AUTH_LABEL_CLASS}>{label}</label>
      <input
        id={id}
        required
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hintId}
        className={AUTH_INPUT_CLASS}
      />
      {hint && (
        <p id={hintId} className="mt-1 text-[11px] text-[#777]">{hint}</p>
      )}
    </div>
  );
}
