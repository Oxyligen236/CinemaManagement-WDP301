/**
 * Thông báo lỗi xác thực trả về cho client.
 *
 * Các thông báo này được hiển thị trực tiếp cho người dùng, nên viết bằng
 * tiếng Việt và phân biệt rõ từng nguyên nhân: sai thông tin đăng nhập là lỗi
 * người dùng có thể tự sửa, còn tài khoản bị vô hiệu hóa thì không.
 */
export const AUTH_MESSAGES = {
  /** Sai email hoặc sai mật khẩu - không tiết lộ email có tồn tại hay không. */
  INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',

  /** Mật khẩu đúng nhưng tài khoản đã bị vô hiệu hóa. */
  ACCOUNT_DISABLED:
    'Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
} as const;
