import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuthenticatedRequest, AuthUser } from '../../domain/auth-user';
import { User, UserDocument } from '../../../user/domain/schemas/user.schema';
import { normalizeRole } from '../../../user/domain/role.normalizer';

@Injectable()
export class JwtGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing access token');
    }

    try {
      const user = await this.jwtService.verifyAsync<AuthUser>(token);
      const account = await this.userModel
        .findOne({ userId: user.sub })
        .select('isActive role tokenVersion')
        .lean()
        .exec();

      if (
        !account ||
        !account.isActive ||
        normalizeRole(account.role) !== normalizeRole(user.role) ||
        (account.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)
      ) {
        throw new UnauthorizedException('Account access has been revoked');
      }
      // Role trong database là nguồn sự thật; chuẩn hóa để downstream (RoleGuard,
      // service) không phải xử lý các value cũ của vai trò Quản lý Chi nhánh.
      request.user = { ...user, role: normalizeRole(account.role)! };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired access token');
    }

    return true;
  }
}
