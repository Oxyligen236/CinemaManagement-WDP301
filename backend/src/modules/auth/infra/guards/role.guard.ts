import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MSG_FORBIDDEN } from '../../domain/constants/auth-message.constants';
import { Role, ROLES_KEY } from '../decorators/role.decorator';
import { AuthenticatedRequest } from '../../domain/auth-user';
import { normalizeRole } from '../../../user/domain/role.normalizer';

/** Dùng sau JwtGuard: @UseGuards(JwtGuard, RoleGuard) + @Roles(Role.ADMIN) */
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const normalizedUserRole = normalizeRole(user?.role);

    if (
      !user ||
      !normalizedUserRole ||
      !requiredRoles.includes(normalizedUserRole)
    ) {
      throw new ForbiddenException(MSG_FORBIDDEN);
    }

    return true;
  }
}
