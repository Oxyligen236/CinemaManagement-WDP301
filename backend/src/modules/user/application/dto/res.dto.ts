export class UserProfileRes {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  branchId?: string | null;
  jobPosition?: string | null;
  employmentStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(entity: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    branchId?: string | null;
    jobPosition?: string | null;
    employmentStatus?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfileRes {
    const res = new UserProfileRes();
    res.id = entity.id;
    res.email = entity.email;
    res.firstName = entity.firstName;
    res.lastName = entity.lastName;
    res.role = entity.role;
    res.branchId = entity.branchId ?? null;
    res.jobPosition = entity.jobPosition ?? null;
    res.employmentStatus = entity.employmentStatus ?? null;
    res.createdAt = entity.createdAt;
    res.updatedAt = entity.updatedAt;
    return res;
  }
}

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
