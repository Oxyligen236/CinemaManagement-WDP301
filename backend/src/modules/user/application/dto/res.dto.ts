/** Kết quả của bước gửi mã xác thực (đăng ký mới hoặc gửi lại mã). */
export class VerificationChallengeRes {
  message!: string;
  email!: string;

  /**
   * `true` khi email đã có đăng ký chờ xác thực từ trước: mã cũ vẫn còn hiệu
   * lực nên hệ thống không sinh mã mới. Frontend dùng cờ này để mở màn hình
   * xác thực với đúng thời gian còn lại thay vì báo lỗi.
   */
  alreadyPending!: boolean;

  /** Số giây còn lại trước khi mã xác thực hết hạn. */
  verificationExpiresInSeconds!: number;

  /** Số giây còn lại trước khi được phép yêu cầu gửi lại mã (0 = gửi được ngay). */
  resendAvailableInSeconds!: number;

  /** Số lần gửi lại mã còn được phép cho đăng ký này. */
  resendsRemaining!: number;
}

/** Trạng thái đăng ký đang chờ xác thực của một email. */
export class VerificationStatusRes {
  email!: string;

  /** `false` khi không còn đăng ký nào chờ xác thực (chưa đăng ký hoặc mã đã hết hạn). */
  pending!: boolean;

  verificationExpiresInSeconds!: number;
  resendAvailableInSeconds!: number;
  resendsRemaining!: number;
}
