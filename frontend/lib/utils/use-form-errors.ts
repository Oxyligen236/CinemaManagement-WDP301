"use client";

import { useCallback, useState } from "react";

export type FieldErrors<T> = Partial<Record<keyof T, string>>;

/**
 * Quản lý lỗi theo từng trường cho các form auth.
 *
 * Hành vi thống nhất giữa các màn hình:
 * 1. Kiểm tra lại khi rời trường (`onBlur`) → hiện lỗi ngay.
 * 2. Xóa lỗi của trường ngay khi người dùng gõ lại trường đó.
 * 3. Khi submit, kiểm tra toàn bộ form và chặn gửi request nếu còn lỗi.
 *
 * @param validate - Hàm kiểm tra toàn bộ form, trả về lỗi theo từng trường.
 */
export function useFormErrors<T extends object>(
  validate: (values: T) => FieldErrors<T>,
) {
  const [fieldErrors, setFieldErrors] = useState<FieldErrors<T>>({});

  const clearFieldError = useCallback((field: keyof T) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }, []);

  const validateField = useCallback(
    (values: T, field: keyof T) => {
      const message = validate(values)[field];
      setFieldErrors((current) => {
        if (!message) {
          if (!current[field]) return current;
          const next = { ...current };
          delete next[field];
          return next;
        }
        return { ...current, [field]: message };
      });
    },
    [validate],
  );

  /** @returns `true` nếu dữ liệu hợp lệ và có thể gửi request. */
  const validateAll = useCallback(
    (values: T) => {
      const errors = validate(values);
      setFieldErrors(errors);
      return Object.keys(errors).length === 0;
    },
    [validate],
  );

  return { fieldErrors, setFieldErrors, clearFieldError, validateField, validateAll };
}
