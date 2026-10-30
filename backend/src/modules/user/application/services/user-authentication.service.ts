import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import { AUTH_MESSAGES } from '../../domain/constants/auth-message.constants';

@Injectable()
export class UserAuthenticationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
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

    return {
      accessToken: await this.jwtService.signAsync(payload),
      user: {
        userId: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        branchId: user.branchId ?? undefined,
      },
    };
  }
}
