import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../domain/types/authenticated-user.type';
import { Role } from './role.decorator';

type RequestUser = {
  userId?: string;
  sub?: string;
  email: string;
  role: Role;
};

/** JwtGuard gán payload JWT (`sub`) vào request.user; chuẩn hoá về `userId`. */
export function toAuthenticatedUser(
  user: RequestUser | undefined,
): AuthenticatedUser | undefined {
  if (!user) return undefined;
  return {
    userId: user.userId ?? user.sub ?? '',
    email: user.email,
    role: user.role,
  };
}

/** Trả về người dùng đã xác thực (được JwtGuard gán vào request.user). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser | undefined => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    return toAuthenticatedUser(request.user);
  },
);
