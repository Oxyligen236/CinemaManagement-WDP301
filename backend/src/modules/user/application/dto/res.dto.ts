export class UserProfileRes {
  id!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  role!: string;
  branchId?: string | null;
  branchName?: string | null;
  jobPosition?: string | null;
  employmentStatus?: string | null;
  createdAt!: Date;
  updatedAt!: Date;

  static of(
    id: string,
    email: string,
    firstName: string,
    lastName: string,
    role: string,
    branchId?: string | null,
    jobPosition?: string | null,
    employmentStatus?: string | null,
    createdAt?: Date,
    updatedAt?: Date,
    branchName?: string | null,
  ): UserProfileRes {
    const res = new UserProfileRes();
    res.id = id;
    res.email = email;
    res.firstName = firstName;
    res.lastName = lastName;
    res.role = role;
    res.branchId = branchId ?? null;
    res.branchName = branchName ?? null;
    res.jobPosition = jobPosition ?? null;
    res.employmentStatus = employmentStatus ?? null;
    res.createdAt = createdAt ?? new Date();
    res.updatedAt = updatedAt ?? new Date();
    return res;
  }

  static fromEntity(entity: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    branchId?: string | null;
    branchName?: string | null;
    jobPosition?: string | null;
    employmentStatus?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): UserProfileRes {
    return UserProfileRes.of(
      entity.id,
      entity.email,
      entity.firstName,
      entity.lastName,
      entity.role,
      entity.branchId,
      entity.jobPosition,
      entity.employmentStatus,
      entity.createdAt,
      entity.updatedAt,
      entity.branchName,
    );
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

  static of(
    message: string,
    email: string,
    alreadyPending: boolean,
    verificationExpiresInSeconds: number,
    resendAvailableInSeconds: number,
    resendsRemaining: number,
  ): VerificationChallengeRes {
    const res = new VerificationChallengeRes();
    Object.assign(res, {
      message,
      email,
      alreadyPending,
      verificationExpiresInSeconds,
      resendAvailableInSeconds,
      resendsRemaining,
    });
    return res;
  }
}

/** Trạng thái đăng ký đang chờ xác thực của một email. */
export class VerificationStatusRes {
  email!: string;

  /** `false` khi không còn đăng ký nào chờ xác thực (chưa đăng ký hoặc mã đã hết hạn). */
  pending!: boolean;

  verificationExpiresInSeconds!: number;
  resendAvailableInSeconds!: number;
  resendsRemaining!: number;

  static of(
    email: string,
    pending: boolean,
    verificationExpiresInSeconds: number,
    resendAvailableInSeconds: number,
    resendsRemaining: number,
  ): VerificationStatusRes {
    const res = new VerificationStatusRes();
    Object.assign(res, {
      email,
      pending,
      verificationExpiresInSeconds,
      resendAvailableInSeconds,
      resendsRemaining,
    });
    return res;
  }
}

export class AuthUserPayloadRes {
  userId!: string;
  email!: string;
  firstName!: string;
  lastName!: string;
  role!: string;
  branchId?: string;
  branchName?: string;

  static of(
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: string,
    branchId?: string,
    branchName?: string,
  ): AuthUserPayloadRes {
    const res = new AuthUserPayloadRes();
    Object.assign(res, {
      userId,
      email,
      firstName,
      lastName,
      role,
      branchId,
      branchName,
    });
    return res;
  }
}

export class LoginSuccessRes {
  accessToken!: string;
  user!: AuthUserPayloadRes;

  static of(accessToken: string, user: AuthUserPayloadRes): LoginSuccessRes {
    const res = new LoginSuccessRes();
    Object.assign(res, { accessToken, user });
    return res;
  }
}
