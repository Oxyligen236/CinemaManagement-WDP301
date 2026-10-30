/**
 * Quy tắc kiểm tra dữ liệu các form xác thực, khớp với DTO của backend
 * (`RegisterDto`, `LoginDto`, `VerifyEmailDto`, `ResetPasswordDto`).
 *
 * Mục đích: chặn dữ liệu sai ngay tại trình duyệt, không gửi request vô ích
 * về backend, và dùng chung một thông báo tiếng Việt cho mọi màn hình auth.
 */

/** `@MinLength(8)` trong `RegisterDto`, `LoginDto`, `ResetPasswordDto`. */
export const PASSWORD_MIN_LENGTH = 8;

/** `@MaxLength(72)` trong `RegisterDto`, `ResetPasswordDto` (giới hạn của bcrypt). */
export const PASSWORD_MAX_LENGTH = 72;

/** `@MaxLength(100)` cho `firstName` / `lastName` trong `RegisterDto`. */
export const NAME_MAX_LENGTH = 100;

/** `@Length(6, 6)` cho `code` trong `VerifyEmailDto`, `ResetPasswordDto`. */
export const VERIFICATION_CODE_LENGTH = 6;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (!email) return "Vui lòng nhập email.";
  if (!EMAIL_PATTERN.test(email)) return "Email không đúng định dạng.";
  return undefined;
}

export function validateName(value: string, label: string): string | undefined {
  const name = value.trim();
  if (!name) return `Vui lòng nhập ${label.toLowerCase()}.`;
  if (name.length > NAME_MAX_LENGTH) {
    return `${label} không được vượt quá ${NAME_MAX_LENGTH} ký tự.`;
  }
  return undefined;
}

/**
 * Kiểm tra mật khẩu.
 *
 * @param label - Nhãn hiển thị trong thông báo lỗi ("Mật khẩu", "Mật khẩu mới").
 * @param enforceMaxLength - Chỉ bật khi backend thực sự giới hạn độ dài.
 *   `LoginDto` không có `@MaxLength`, nên màn hình đăng nhập phải để `false`
 *   để không chặn oan mật khẩu hợp lệ đã tồn tại.
 */
export function validatePassword(
  value: string,
  { label = "Mật khẩu", enforceMaxLength = true } = {},
): string | undefined {
  if (!value) return `Vui lòng nhập ${label.toLowerCase()}.`;
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `${label} phải có tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`;
  }
  if (enforceMaxLength && value.length > PASSWORD_MAX_LENGTH) {
    return `${label} không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự.`;
  }
  return undefined;
}

export function validateConfirmPassword(
  value: string,
  password: string,
): string | undefined {
  if (!value) return "Vui lòng nhập lại mật khẩu.";
  if (value !== password) return "Mật khẩu xác nhận không khớp.";
  return undefined;
}

/** Mã do backend sinh và gửi qua email: đúng 6 chữ số. */
export function validateVerificationCode(value: string): string | undefined {
  const code = value.trim();
  if (!code) return "Vui lòng nhập mã xác thực.";
  if (!new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`).test(code)) {
    return `Mã xác thực phải gồm đúng ${VERIFICATION_CODE_LENGTH} chữ số.`;
  }
  return undefined;
}
