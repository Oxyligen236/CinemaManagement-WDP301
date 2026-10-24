import { Role } from '../../infra/decorators/role.decorator';

/** Thông tin người dùng đã xác thực, được JwtGuard gán vào request.user. */
export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: Role;
};
