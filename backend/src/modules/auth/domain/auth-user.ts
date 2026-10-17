import type { Request } from 'express';
import { Role } from '../../user/domain/enums/role.enum';

/** Payload nằm trong JWT (xem UserAuthenticationService.login). */
export interface AuthUser {
  sub: string; // userId
  email: string;
  role: Role;
  tokenVersion: number;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };
