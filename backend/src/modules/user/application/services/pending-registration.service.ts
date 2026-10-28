import { Injectable } from '@nestjs/common';

export interface PendingUser {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
  /** Số lần đã gửi lại mã, dùng để chặn dò mã bằng cách xin mã mới liên tục. */
  resendCount: number;
}

@Injectable()
export class PendingRegistrationService {
  private readonly pendingUsers = new Map<string, PendingUser>();

  save(email: string, data: PendingUser): void {
    this.pendingUsers.set(email, data);
  }

  get(email: string): PendingUser | undefined {
    const data = this.pendingUsers.get(email);
    if (!data) return undefined;

    if (Date.now() >= data.expiresAt) {
      this.pendingUsers.delete(email);
      return undefined;
    }
    return data;
  }

  delete(email: string): void {
    this.pendingUsers.delete(email);
  }
}
