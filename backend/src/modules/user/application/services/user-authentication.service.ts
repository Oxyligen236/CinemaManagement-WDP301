import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AUTH_MESSAGES } from '../../domain/constants/auth-message.constants';
import { AuthUserPayloadRes, LoginSuccessRes } from '../dto/res.dto';

@Injectable()
export class UserAuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string): Promise<LoginSuccessRes> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { branch: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS);
    }

    if (!user.isActive) {
      throw new UnauthorizedException(AUTH_MESSAGES.ACCOUNT_DISABLED);
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId ?? undefined,
      tokenVersion: user.tokenVersion ?? 0,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return LoginSuccessRes.of(
      accessToken,
      AuthUserPayloadRes.of(
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.role,
        user.branchId ?? undefined,
        user.branch?.branchName ?? undefined,
      ),
    );
  }
}
