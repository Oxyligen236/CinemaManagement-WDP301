import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UserAuthenticationService } from './user-authentication.service';
import { Role } from '@prisma/client';
import { AUTH_MESSAGES } from '../../domain/constants/auth-message.constants';
import { PrismaService } from '../../../infra/prisma/prisma.service';

type StoredUser = {
  id: string;
  email: string;
  password: string;
  isActive: boolean;
  tokenVersion?: number;
  firstName: string;
  lastName: string;
  role: Role;
  branchId?: string | null;
};

const PASSWORD = 'Password123!';

const buildUser = (overrides: Partial<StoredUser> = {}): StoredUser => ({
  id: 'u-1',
  email: 'manager@cinema.local',
  password: bcrypt.hashSync(PASSWORD, 4),
  isActive: true,
  tokenVersion: 0,
  firstName: 'Minh',
  lastName: 'Manager',
  role: Role.MANAGER,
  branchId: 'b-1',
  ...overrides,
});

const buildService = (user: StoredUser | null) => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
    },
  };

  const signAsync = jest.fn().mockResolvedValue('signed-token');
  const jwtService = { signAsync } as unknown as JwtService;

  return {
    service: new UserAuthenticationService(
      mockPrisma as unknown as PrismaService,
      jwtService,
    ),
    signAsync,
  };
};

describe('UserAuthenticationService.login', () => {
  it('rejects an unknown email with the invalid-credentials message', async () => {
    const { service } = buildService(null);

    await expect(
      service.login('nobody@cinema.local', PASSWORD),
    ).rejects.toThrow(
      new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS),
    );
  });

  it('rejects a wrong password with the same message as an unknown email', async () => {
    const { service } = buildService(buildUser());

    await expect(
      service.login('manager@cinema.local', 'WrongPassword1!'),
    ).rejects.toThrow(
      new UnauthorizedException(AUTH_MESSAGES.INVALID_CREDENTIALS),
    );
  });

  it('tells a disabled account apart from wrong credentials', async () => {
    const { service } = buildService(buildUser({ isActive: false }));

    await expect(
      service.login('manager@cinema.local', PASSWORD),
    ).rejects.toThrow(
      new UnauthorizedException(AUTH_MESSAGES.ACCOUNT_DISABLED),
    );
  });

  it('puts the stored role into the token and the response', async () => {
    const { service, signAsync } = buildService(buildUser());

    const result = await service.login('manager@cinema.local', PASSWORD);

    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.MANAGER }),
    );
    expect(result.user.role).toBe(Role.MANAGER);
  });
});
