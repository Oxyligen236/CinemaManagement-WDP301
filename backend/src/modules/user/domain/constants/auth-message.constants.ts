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

/** Độ dài mật khẩu: tối thiểu theo chính sách, tối đa theo giới hạn của bcrypt. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
export const NAME_MAX_LENGTH = 100;
export const VERIFICATION_CODE_LENGTH = 6;

/**
 * Thông báo cho lỗi validate dữ liệu đầu vào của các endpoint `/auth/*`.
 *
 * `ValidationPipe` trả nguyên văn `message` của decorator cho client, nên phải
 * khai báo bằng tiếng Việt tại đây. Nếu để class-validator sinh message mặc
 * định (tiếng Anh, không dấu), frontend không nhận ra đó là thông báo nghiệp vụ
 * và sẽ thay bằng một câu chung chung, khiến người dùng không biết sai ở đâu.
 */
export const AUTH_VALIDATION_MESSAGES = {
  EMAIL_REQUIRED: 'Vui lòng nhập email.',
  EMAIL_INVALID: 'Email không đúng định dạng.',

  PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu.',
  PASSWORD_MIN: `Mật khẩu phải có tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`,
  PASSWORD_MAX: `Mật khẩu không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự.`,

  NEW_PASSWORD_REQUIRED: 'Vui lòng nhập mật khẩu mới.',
  NEW_PASSWORD_MIN: `Mật khẩu mới phải có tối thiểu ${PASSWORD_MIN_LENGTH} ký tự.`,
  NEW_PASSWORD_MAX: `Mật khẩu mới không được vượt quá ${PASSWORD_MAX_LENGTH} ký tự.`,

  FIRST_NAME_REQUIRED: 'Vui lòng nhập tên.',
  FIRST_NAME_MAX: `Tên không được vượt quá ${NAME_MAX_LENGTH} ký tự.`,
  LAST_NAME_REQUIRED: 'Vui lòng nhập họ.',
  LAST_NAME_MAX: `Họ không được vượt quá ${NAME_MAX_LENGTH} ký tự.`,

  CODE_REQUIRED: 'Vui lòng nhập mã xác thực.',
  CODE_LENGTH: `Mã xác thực phải gồm đúng ${VERIFICATION_CODE_LENGTH} chữ số.`,
} as const;

/** Thông báo nghiệp vụ của luồng đăng ký và xác thực email. */
export const REGISTRATION_MESSAGES = {
  INVALID_DATA: 'Thông tin đăng ký không hợp lệ. Vui lòng kiểm tra lại.',
  ALL_FIELDS_REQUIRED: 'Vui lòng nhập đầy đủ thông tin đăng ký.',
  EMAIL_REQUIRED: AUTH_VALIDATION_MESSAGES.EMAIL_REQUIRED,

  /** Email đã có tài khoản: hướng người dùng sang đăng nhập thay vì thử lại. */
  EMAIL_ALREADY_REGISTERED:
    'Email này đã được đăng ký. Vui lòng đăng nhập hoặc dùng email khác.',

  /**
   * Email đang có đăng ký chờ xác thực: không phải lỗi, mã cũ vẫn còn hiệu lực
   * nên frontend mở lại màn hình xác thực thay vì báo lỗi ở trang đăng ký.
   */
  VERIFICATION_PENDING:
    'Email này đang chờ xác thực. Vui lòng nhập mã đã được gửi trước đó.',

  RESEND_COOLDOWN: 'Vui lòng đợi một phút trước khi yêu cầu mã xác thực mới.',
  NO_PENDING_REGISTRATION:
    'Không có đăng ký nào đang chờ xác thực. Vui lòng đăng ký lại.',
  RESEND_LIMIT_REACHED: 'Bạn đã hết số lần gửi lại mã. Vui lòng đăng ký lại.',
  CODE_INVALID_OR_EXPIRED: 'Mã xác thực không đúng hoặc đã hết hạn.',
  TOO_MANY_ATTEMPTS: 'Bạn đã nhập sai mã quá nhiều lần. Vui lòng đăng ký lại.',
} as const;

/** Thông báo nghiệp vụ của luồng quên mật khẩu / đặt lại mật khẩu. */
export const PASSWORD_RESET_MESSAGES = {
  EMAIL_REQUIRED: AUTH_VALIDATION_MESSAGES.EMAIL_REQUIRED,
  RESEND_COOLDOWN: 'Vui lòng đợi một phút trước khi yêu cầu mã đặt lại mới.',
  EMAIL_AND_CODE_REQUIRED: `Vui lòng nhập email và mã xác thực gồm ${VERIFICATION_CODE_LENGTH} chữ số.`,
  NEW_PASSWORD_MIN: AUTH_VALIDATION_MESSAGES.NEW_PASSWORD_MIN,
  CODE_INVALID_OR_EXPIRED: 'Mã đặt lại không đúng hoặc đã hết hạn.',
  TOO_MANY_ATTEMPTS:
    'Bạn đã nhập sai mã quá nhiều lần. Vui lòng yêu cầu mã đặt lại mới.',
  ACCOUNT_NOT_FOUND: 'Không tìm thấy tài khoản với email này.',
} as const;
