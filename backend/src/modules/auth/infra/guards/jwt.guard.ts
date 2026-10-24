import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MSG_UNAUTHORIZED } from '../../domain/constants/auth-message.constants';
import { AuthenticatedUser } from '../../domain/types/authenticated-user.type';
import { Role } from '../decorators/role.decorator';

type JwtPayload = { sub: string; email: string; role: Role };
type AuthRequest = {
  headers: Record<string, string | string[] | undefined>;
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.extractBearerToken(request);
    if (!token) {
      throw new UnauthorizedException(MSG_UNAUTHORIZED);
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      request.user = {
        userId: payload.sub,
        email: payload.email,
        role: payload.role,
      };
    } catch {
      throw new UnauthorizedException(MSG_UNAUTHORIZED);
    }
    return true;
  }

  private extractBearerToken(request: AuthRequest): string | undefined {
    const header = request.headers['authorization'];
    if (typeof header !== 'string') return undefined;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' && token ? token : undefined;
  }
}
