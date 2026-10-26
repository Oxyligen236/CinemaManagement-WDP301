"use client";

import React from "react";
import { AUTH_INPUT_CLASS, AUTH_LABEL_CLASS } from "./auth-shell";

export type AuthFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Gọi khi rời khỏi trường, dùng để kiểm tra lại giá trị vừa nhập. */
  onBlur?: () => void;
  type?: string;
  /** Mô tả phụ dưới trường (ví dụ: "Tối thiểu 8 ký tự"). */
  hint?: string;
  /** Thông báo lỗi của trường. Có lỗi thì input đổi viền đỏ + `aria-invalid`. */
  error?: string;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: React.ComponentProps<"input">["inputMode"];
  /** Class bổ sung cho input (ví dụ: ô mã OTP căn giữa, giãn chữ). */
  inputClassName?: string;
  /** Nội dung phụ dưới trường, ví dụ link "Quên mật khẩu?". */
  children?: React.ReactNode;
};

/**
 * Trường nhập dùng chung cho mọi màn hình auth.
 * Gom nhãn, input, thông báo lỗi và thuộc tính accessibility vào một chỗ
 * để 4 trang auth hiển thị lỗi thống nhất (theo `design.md` §3.2).
 */
export function AuthField({
  id,
  label,
  value,
  onChange,
  onBlur,
  type = "text",
  hint,
  error,
  required = true,
  maxLength,
  minLength,
  placeholder,
  autoComplete,
  inputMode,
  inputClassName,
  children,
}: AuthFieldProps): React.JSX.Element {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className={AUTH_LABEL_CLASS}>
        {label}
      </label>
      <input
        id={id}
        required={required}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        maxLength={maxLength}
        minLength={minLength}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`${AUTH_INPUT_CLASS} ${inputClassName ?? ""} ${
          error
            ? "border-[#b82116] focus:border-[#b82116] focus:ring-[#b82116]"
            : ""
        }`}
      />
      {error && (
        <p
          id={errorId}
          className="mt-1 text-[11px] font-semibold text-[#b82116]"
        >
          {error}
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1 text-[11px] text-[#777]">
          {hint}
        </p>
      )}
      {children}
    </div>
  );
}
