import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserAuthenticationService } from './user-authentication.service';
import { UserDocument } from '../../domain/schemas/user.schema';
import { Role } from '../../domain/enums/role.enum';
import { AUTH_MESSAGES } from '../../domain/constants/auth-message.constants';

type StoredUser = {
  userId: string;
  email: string;
  password: string;
  isActive: boolean;
  tokenVersion?: number;
  firstName: string;
  lastName: string;
  role: string;
};

const PASSWORD = 'Password123!';

const buildUser = (overrides: Partial<StoredUser> = {}): StoredUser => ({
  userId: 'u-1',
  email: 'manager@cinema.local',
  password: bcrypt.hashSync(PASSWORD, 4),
  isActive: true,
  tokenVersion: 0,
  firstName: 'Minh',
  lastName: 'Manager',
  role: Role.BRANCHMANAGER,
  ...overrides,
});

const buildService = (user: StoredUser | null) => {
  const userModel = {
    findOne: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(user),
      }),
    }),
  } as unknown as Model<UserDocument>;

  const signAsync = jest.fn().mockResolvedValue('signed-token');
  const jwtService = { signAsync } as unknown as JwtService;

  return {
    service: new UserAuthenticationService(userModel, jwtService),
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

  it('normalizes a legacy Branch Manager role in the token and the response', async () => {
    const { service, signAsync } = buildService(
      buildUser({ role: 'BRANCHMANAGER' }),
    );

    const result = await service.login('manager@cinema.local', PASSWORD);

    expect(result.user.role).toBe(Role.BRANCHMANAGER);
    expect(signAsync).toHaveBeenCalledWith(
      expect.objectContaining({ role: Role.BRANCHMANAGER }),
    );
  });
});
