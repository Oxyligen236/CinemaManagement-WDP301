import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticatedRequest, AuthUser } from '../../domain/auth-user';
import { PrismaService } from '../../../infra/prisma/prisma.service';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const user = await this.jwtService.verifyAsync<AuthUser>(token);
      const account = await this.prisma.user.findUnique({
        where: { id: user.sub },
        select: { isActive: true, role: true, tokenVersion: true },
      });

      if (
        !account ||
        !account.isActive ||
        account.role !== user.role ||
        (account.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)
      ) {
        throw new UnauthorizedException('Account access has been revoked');
      }
      request.user = { ...user, role: account.role as any };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }
}
